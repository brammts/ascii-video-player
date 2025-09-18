/**
 * Video Processor - Обработка видео для ASCII конвертации
 */
class VideoProcessor {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.isProcessing = false;
        this.currentFrame = 0;
        this.totalFrames = 0;
        this.fps = 30;
        this.duration = 0;
        this.audioElement = null;
        this.frameCache = new Map(); // Кэш для кадров
        this.cacheSize = 10; // Максимальный размер кэша
        this.performanceMonitor = {
            frameTimes: [],
            maxSamples: 10,
            targetFrameTime: 33 // 30 FPS = 33ms на кадр
        };
    }

    /**
     * Инициализирует обработчик видео
     */
    init() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    /**
     * Загружает видеофайл
     * @param {File} file - Видеофайл
     * @returns {Promise<Object>} - Информация о видео
     */
    async loadVideo(file, onProgress = null) {
        // Очищаем предыдущее состояние
        this.cleanup();
        
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'auto'; // Загружаем все данные
            video.muted = true; // Отключаем звук для загрузки
            // Убираем crossOrigin для локальных файлов
            
            let metadataLoaded = false;
            let canPlayLoaded = false;
            let timeoutId;
            
            // Отслеживаем прогресс загрузки
            const updateProgress = (progress, status) => {
                if (onProgress) {
                    onProgress(progress, status);
                }
            };
            
            // Таймаут для загрузки видео (30 секунд)
            timeoutId = setTimeout(() => {
                if (!metadataLoaded) {
                    reject(new Error('Таймаут загрузки метаданных видео'));
                } else if (!canPlayLoaded) {
                    console.warn('Таймаут загрузки видео, продолжаем с доступными данными');
                    canPlayLoaded = true;
                    checkComplete();
                }
            }, 30000);
            
            // Дополнительный таймаут для принудительного завершения
            setTimeout(() => {
                if (metadataLoaded && !canPlayLoaded) {
                    console.warn('Принудительное завершение загрузки видео');
                    canPlayLoaded = true;
                    checkComplete();
                }
            }, 10000); // 10 секунд после загрузки метаданных
            
            let isResolved = false;
            
            const checkComplete = () => {
                if (isResolved) return; // Предотвращаем множественные вызовы
                
                // Проверяем, что видео действительно готово
                const isVideoReady = metadataLoaded && 
                                   video.readyState >= 4 && 
                                   video.duration > 0 &&
                                   video.videoWidth > 0 && 
                                   video.videoHeight > 0;
                
                if (isVideoReady) {
                    // Дополнительная проверка буфера
                    const bufferInfo = this.getBufferInfo();
                    const hasEnoughBuffer = bufferInfo.percentage >= 50 || bufferInfo.percentage === 0; // 0% может быть для очень коротких видео
                    
                    if (hasEnoughBuffer) {
                        isResolved = true;
                        clearTimeout(timeoutId);
                        this.video = video;
                        this.fps = 30; // Базовый FPS
                        this.duration = video.duration;
                        this.totalFrames = Math.floor(video.duration * this.fps);
                        
                        // Создаем отдельный аудио элемент для воспроизведения
                        this.audioElement = video.cloneNode();
                        this.audioElement.muted = false;
                        this.audioElement.volume = 0.7;
                        
                        updateProgress(100, `Видео готово к воспроизведению (${bufferInfo.percentage.toFixed(1)}% загружено)`);
                        resolve({
                            duration: video.duration,
                            width: video.videoWidth,
                            height: video.videoHeight,
                            fps: this.fps,
                            totalFrames: this.totalFrames
                        });
                    } else {
                        updateProgress(95, `Загрузка завершается... ${bufferInfo.percentage.toFixed(1)}%`);
                    }
                } else {
                    // Показываем прогресс загрузки
                    if (video.readyState >= 1) {
                        updateProgress(30, 'Загружаются метаданные...');
                    }
                    if (video.readyState >= 2) {
                        updateProgress(50, 'Загружаются данные...');
                    }
                    if (video.readyState >= 3) {
                        updateProgress(80, 'Почти готово...');
                    }
                }
            };
            
            video.onloadedmetadata = () => {
                metadataLoaded = true;
                updateProgress(30, 'Метаданные загружены');
                // Не вызываем checkComplete здесь, ждем больше данных
            };
            
            video.oncanplay = () => {
                canPlayLoaded = true;
                updateProgress(70, 'Видео готово к воспроизведению');
                // Не вызываем checkComplete здесь, ждем больше данных
            };
            
            video.oncanplaythrough = () => {
                canPlayLoaded = true;
                updateProgress(90, 'Видео полностью загружено');
                checkComplete();
            };
            
            video.onloadstart = () => {
                updateProgress(10, 'Начало загрузки...');
            };
            
            video.onload = () => {
                updateProgress(80, 'Видео загружено');
            };
            
            video.onprogress = () => {
                if (video.buffered.length > 0) {
                    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                    const duration = video.duration;
                    if (duration > 0) {
                        const progress = (bufferedEnd / duration) * 100;
                        updateProgress(Math.min(progress, 95), `Загрузка видео... ${progress.toFixed(1)}%`);
                        
                        // Проверяем готовность после загрузки достаточного количества данных
                        if (progress >= 90 && video.readyState >= 4) {
                            checkComplete();
                        }
                    }
                }
            };
            
            video.onerror = (error) => {
                clearTimeout(timeoutId);
                console.error('Ошибка загрузки видео:', error);
                reject(new Error('Ошибка загрузки видео: ' + (error.message || 'Неизвестная ошибка')));
            };
            
            video.src = URL.createObjectURL(file);
        });
    }

    /**
     * Извлекает кадр из видео с кэшированием
     * @param {number} time - Время в секундах
     * @param {number} width - Ширина кадра
     * @param {number} height - Высота кадра
     * @returns {Promise<ImageData>} - Данные кадра
     */
    async extractFrame(time, width, height) {
        // Создаем ключ для кэша
        const cacheKey = `${time.toFixed(2)}_${width}_${height}`;
        
        // Проверяем кэш
        if (this.frameCache.has(cacheKey)) {
            return this.frameCache.get(cacheKey);
        }
        
        // Если кэш переполнен, очищаем старые записи
        if (this.frameCache.size >= this.cacheSize) {
            const firstKey = this.frameCache.keys().next().value;
            this.frameCache.delete(firstKey);
        }
        
        // Извлекаем кадр с повторными попытками
        const imageData = await this.extractFrameWithRetry(time, width, height);
        
        // Сохраняем в кэш
        this.frameCache.set(cacheKey, imageData);
        
        return imageData;
    }

    /**
     * Извлекает кадр с повторными попытками
     * @param {number} time - Время в секундах
     * @param {number} width - Ширина кадра
     * @param {number} height - Высота кадра
     * @param {number} maxRetries - Максимальное количество попыток
     * @returns {Promise<ImageData>} - Данные кадра
     */
    async extractFrameWithRetry(time, width, height, maxRetries = 3, isMobile = false) {
        let lastError;
        
        // Увеличиваем количество попыток для мобильных устройств
        const actualMaxRetries = isMobile ? Math.max(maxRetries, 5) : maxRetries;
        
        for (let attempt = 1; attempt <= actualMaxRetries; attempt++) {
            try {
                return await this.extractFrameInternal(time, width, height, isMobile);
            } catch (error) {
                lastError = error;
                const errorMessage = error && error.message ? error.message : 'Неизвестная ошибка';
                console.warn(`Попытка ${attempt}/${actualMaxRetries} извлечения кадра в ${time.toFixed(2)}с не удалась:`, errorMessage);
                console.error('Детали ошибки:', error);
                
                if (attempt < actualMaxRetries) {
                    // Прогрессивная задержка: для мобильных устройств увеличиваем задержки
                    const baseDelay = isMobile ? 1000 : 500;
                    const delay = baseDelay * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    // Дополнительная проверка состояния видео
                    if (this.video) {
                        
                        if (this.video.readyState < 2) {
                            const additionalWait = isMobile ? 2000 : 1000;
                            await new Promise(resolve => setTimeout(resolve, additionalWait));
                        }
                    } else {
                        console.error('Видео элемент потерян!');
                        break; // Прерываем попытки если видео потеряно
                    }
                }
            }
        }
        
        throw new Error(`Не удалось извлечь кадр в ${time.toFixed(2)}с после ${actualMaxRetries} попыток. Последняя ошибка: ${lastError.message}`);
    }

    /**
     * Внутренний метод извлечения кадра
     * @param {number} time - Время в секундах
     * @param {number} width - Ширина кадра
     * @param {number} height - Высота кадра
     * @param {boolean} isMobile - Является ли устройство мобильным
     * @returns {Promise<ImageData>} - Данные кадра
     */
    async extractFrameInternal(time, width, height, isMobile = false) {
        if (!this.video) {
            throw new Error('Видео не загружено');
        }

        // Проверяем состояние видео
        if (this.video.readyState < 1) {
            throw new Error(`Видео не загружено. Состояние: ${this.video.readyState}`);
        }
        
        // Если видео только загружает метаданные или данные еще не готовы, ждем
        if (this.video.readyState < 2) {
            // Для readyState < 2 (нет данных) ждем загрузки метаданных
            let waitTime = 500;
            let maxWaitTime = isMobile ? 10000 : 5000;
            let totalWaitTime = 0;
            
            while (this.video.readyState < 2 && totalWaitTime < maxWaitTime) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
                totalWaitTime += waitTime;
                waitTime = Math.min(waitTime * 1.1, 2000);
            }
            
            if (this.video.readyState < 2) {
                const readyStateText = this.getReadyStateText(this.video.readyState);
                throw new Error(`Видео не загружено (${readyStateText}). Попробуйте подождать еще немного.`);
            }
        }
        
        // Если есть метаданные, но нет достаточно данных для воспроизведения, ждем
        if (this.video.readyState < 4) {
            // Принудительно загружаем данные для текущего времени
            this.video.load();
            
            // Ждем загрузки достаточных данных с ограниченным временем ожидания
            let waitTime = 500;
            let maxWaitTime = isMobile ? 20000 : 12000; // Увеличиваем время ожидания
            let totalWaitTime = 0;
            
            while (this.video.readyState < 4 && totalWaitTime < maxWaitTime) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
                totalWaitTime += waitTime;
                waitTime = Math.min(waitTime * 1.1, 2000);
                
                // Периодически пытаемся загрузить больше данных
                if (totalWaitTime % 2000 === 0) {
                    this.video.load();
                }
            }
            
            // Если все еще не готово, но есть метаданные, пытаемся извлечь кадр
            if (this.video.readyState < 4) {
                console.warn(`Видео не полностью загружено (${this.getReadyStateText(this.video.readyState)}), но пытаемся извлечь кадр...`);
                // Продолжаем выполнение, так как для извлечения кадра может быть достаточно метаданных
            }
        }

        // Проверяем валидность времени
        if (time < 0 || time > this.duration) {
            throw new Error(`Некорректное время кадра: ${time}. Длительность видео: ${this.duration}`);
        }

        // Дополнительная проверка для мобильных устройств
        if (isMobile && this.video.readyState < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return new Promise((resolve, reject) => {
            // Используем оригинальное видео, а не клон
            const video = this.video;
            const originalTime = video.currentTime;
            
            // // Дополнительная проверка состояния видео
            // if (!video || video.readyState < 3) {
            //     return;
            // }
            
            let resolved = false;
            let timeoutId;
            
            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                // Восстанавливаем оригинальное время только если оно было изменено
                if (Math.abs(video.currentTime - originalTime) > 0.1) {
                    video.currentTime = originalTime;
                }
            };
            
            // Адаптивный таймаут в зависимости от сложности видео
            const baseTimeout = 10000; // 10 секунд базовый таймаут
            const videoComplexity = this.video.videoWidth * this.video.videoHeight;
            let adaptiveTimeout = Math.min(30000, baseTimeout + (videoComplexity / 1000000) * 5000);
            
            // Увеличиваем таймаут для мобильных устройств
            if (isMobile) {
                adaptiveTimeout = Math.min(45000, adaptiveTimeout * 1.5); // Увеличиваем на 50% для мобильных
            }
            
            timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    reject(new Error('Таймаут извлечения кадра'));
                }
            }, adaptiveTimeout);
            
            const onSeeked = () => {
                if (resolved) return;
                resolved = true;
                
                try {
                    // Устанавливаем размеры canvas
                    this.canvas.width = width;
                    this.canvas.height = height;
                    
                    // Очищаем canvas
                    this.ctx.clearRect(0, 0, width, height);
                    
                    // Рисуем кадр на canvas с правильными пропорциями
                    const videoAspect = video.videoWidth / video.videoHeight;
                    const canvasAspect = width / height;
                    
                    let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
                    
                    if (videoAspect > canvasAspect) {
                        // Видео шире - подгоняем по ширине
                        drawWidth = width;
                        drawHeight = width / videoAspect;
                        offsetY = (height - drawHeight) / 2;
                    } else {
                        // Видео выше - подгоняем по высоте
                        drawHeight = height;
                        drawWidth = height * videoAspect;
                        offsetX = (width - drawWidth) / 2;
                    }
                    
                    // Очищаем canvas черным фоном
                    this.ctx.fillStyle = '#000000';
                    this.ctx.fillRect(0, 0, width, height);
                    
                    // Рисуем видео с правильными пропорциями
                    this.ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
                    
                    // Получаем данные пикселей
                    const imageData = this.ctx.getImageData(0, 0, width, height);
                    cleanup();
                    resolve(imageData);
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            };
            
            const onError = (error) => {
                if (resolved) return;
                resolved = true;
                cleanup();
                const errorMessage = error && error.message ? error.message : 'Неизвестная ошибка извлечения кадра';
                console.error('Ошибка извлечения кадра:', error);
                reject(new Error('Ошибка извлечения кадра: ' + errorMessage));
            };
            
            // Устанавливаем обработчики
            video.addEventListener('seeked', onSeeked, { once: true });
            video.addEventListener('error', onError, { once: true });
            
            // Устанавливаем время
            video.currentTime = time;
        });
    }


    /**
     * Мониторит производительность и адаптирует качество
     * @param {number} frameTime - Время обработки кадра в мс
     * @param {Object} settings - Настройки обработки
     * @returns {Object} - Адаптированные настройки
     */
    adaptQuality(frameTime, settings) {
        // Добавляем время обработки в монитор
        this.performanceMonitor.frameTimes.push(frameTime);
        
        // Ограничиваем количество образцов
        if (this.performanceMonitor.frameTimes.length > this.performanceMonitor.maxSamples) {
            this.performanceMonitor.frameTimes.shift();
        }
        
        // Вычисляем среднее время обработки
        const avgFrameTime = this.performanceMonitor.frameTimes.reduce((a, b) => a + b, 0) / this.performanceMonitor.frameTimes.length;
        
        // Адаптируем качество на основе производительности
        let adaptedSettings = { ...settings };
        
        if (avgFrameTime > this.performanceMonitor.targetFrameTime * 1.5) {
            // Снижаем качество при плохой производительности
            adaptedSettings.asciiWidth = Math.max(60, Math.floor(settings.asciiWidth * 0.8));
            adaptedSettings.asciiHeight = Math.max(20, Math.floor(settings.asciiHeight * 0.8));
        } else if (avgFrameTime < this.performanceMonitor.targetFrameTime * 0.5) {
            // Повышаем качество при хорошей производительности
            adaptedSettings.asciiWidth = Math.min(200, Math.floor(settings.asciiWidth * 1.1));
            adaptedSettings.asciiHeight = Math.min(80, Math.floor(settings.asciiHeight * 1.1));
        }
        
        return adaptedSettings;
    }

    /**
     * Конвертирует ImageData в ASCII (оптимизированная версия для реального времени)
     * @param {ImageData} imageData - Данные изображения
     * @param {Object} settings - Настройки конвертации
     * @returns {string} - ASCII строка
     */
    convertToASCII(imageData, settings) {
        const { data, width, height } = imageData;
        const { asciiWidth, asciiHeight } = settings;
        
        // Оптимизированная палитра ASCII символов для быстрой обработки
        const asciiChars = " .:-=+*#%@";
        const charCount = asciiChars.length;
        
        // Вычисляем шаг для уменьшения размера
        const stepX = Math.max(1, Math.floor(width / asciiWidth));
        const stepY = Math.max(1, Math.floor(height / asciiHeight));
        
        // Предварительно вычисляем размеры для оптимизации
        const maxY = height - stepY;
        const maxX = width - stepX;
        const stepX4 = stepX * 4;
        const width4 = width * 4;
        
        // Используем массив для более быстрой конкатенации
        const lines = [];
        
        for (let y = 0; y <= maxY; y += stepY) {
            let line = '';
            const yWidth4 = y * width4;
            
            for (let x = 0; x <= maxX; x += stepX) {
                // Вычисляем среднее значение в области (оптимизированно)
                let rSum = 0, gSum = 0, bSum = 0, count = 0;
                const startPixel = yWidth4 + x * 4;
                
                for (let dy = 0; dy < stepY; dy++) {
                    const dyWidth4 = (y + dy) * width4;
                    for (let dx = 0; dx < stepX; dx++) {
                        const pixelIndex = dyWidth4 + (x + dx) * 4;
                        rSum += data[pixelIndex];
                        gSum += data[pixelIndex + 1];
                        bSum += data[pixelIndex + 2];
                        count++;
                    }
                }
                
                // Быстрое вычисление серого без деления
                const gray = Math.round((rSum * 0.299 + gSum * 0.587 + bSum * 0.114) / count);
                
                // Быстрый выбор символа
                const charIndex = Math.min(charCount - 1, Math.floor(gray * (charCount - 1) / 255));
                line += asciiChars[charIndex];
            }
            lines.push(line);
        }
        
        return lines.join('\n');
    }

    /**
     * Создает пустой ASCII кадр
     * @param {number} width - Ширина в символах
     * @param {number} height - Высота в символах
     * @returns {string} - Пустой ASCII кадр
     */
    createEmptyFrame(width, height) {
        let frame = '';
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                frame += ' ';
            }
            frame += '\n';
        }
        return frame;
    }

    /**
     * Улучшает контраст для лучшего ASCII рендеринга
     * @param {number} gray - Значение серого
     * @param {Uint8ClampedArray} data - Данные пикселей
     * @param {number} pixelIndex - Индекс пикселя
     * @param {number} width - Ширина изображения
     * @param {number} stepX - Шаг по X
     * @param {number} stepY - Шаг по Y
     * @returns {number} - Улучшенное значение
     */
    enhanceContrast(gray, data, pixelIndex, width, stepX = 1, stepY = 1) {
        // Анализируем локальную область для лучшего контраста
        const radius = Math.max(1, Math.min(stepX, stepY));
        let localSum = 0;
        let localCount = 0;
        
        // Вычисляем среднее значение в локальной области
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const newIndex = pixelIndex + (dy * width + dx) * 4;
                if (newIndex >= 0 && newIndex < data.length) {
                    const r = data[newIndex];
                    const g = data[newIndex + 1];
                    const b = data[newIndex + 2];
                    const localGray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                    localSum += localGray;
                    localCount++;
                }
            }
        }
        
        const localAverage = localCount > 0 ? localSum / localCount : gray;
        
        // Применяем адаптивное улучшение контраста
        const contrast = 1.3;
        const brightness = 5;
        const localContrast = Math.abs(gray - localAverage) / 255;
        
        let enhanced = (gray - localAverage) * contrast + localAverage + brightness;
        
        // Дополнительное усиление для высокого контраста
        if (localContrast > 0.3) {
            enhanced = (enhanced - 128) * 1.1 + 128;
        }
        
        enhanced = Math.max(0, Math.min(255, enhanced));
        
        return Math.round(enhanced);
    }

    /**
     * Останавливает обработку
     */
    stopProcessing() {
        this.isProcessing = false;
    }

    /**
     * Запускает воспроизведение звука
     */
    playAudio() {
        if (this.audioElement) {
            this.audioElement.currentTime = 0;
            this.audioElement.play().catch(e => {
                console.warn('Не удалось воспроизвести звук:', e);
            });
        }
    }

    /**
     * Останавливает воспроизведение звука
     */
    stopAudio() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
    }

    /**
     * Устанавливает громкость звука
     */
    setVolume(volume) {
        if (this.audioElement) {
            this.audioElement.volume = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Синхронизирует звук с видео
     */
    syncAudio(currentTime) {
        if (this.audioElement && this.audioElement.readyState >= 2) {
            const timeDiff = Math.abs(this.audioElement.currentTime - currentTime);
            if (timeDiff > 0.1) { // Если рассинхронизация больше 0.1 секунды
                try {
                    this.audioElement.currentTime = currentTime;
                } catch (error) {
                    console.warn('Ошибка синхронизации звука:', error);
                }
            }
        }
    }

    /**
     * Убеждается что видео полностью загружено
     * @returns {Promise<boolean>} - true если видео готово
     */
    async ensureVideoLoaded() {
        if (!this.video) {
            return false;
        }

        // Если видео уже готово, возвращаем true
        if (this.video.readyState >= 2) {
            return true;
        }

        // Если видео только загружает метаданные, ждем загрузки данных
        if (this.video.readyState === 1) {
            
            return new Promise((resolve) => {
                let resolved = false;
                const maxWaitTime = 5000; // 5 секунд максимум
                
                const timeoutId = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        console.warn('Таймаут загрузки видео, продолжаем с доступными данными');
                        resolve(true); // Продолжаем даже если видео не полностью загружено
                    }
                }, maxWaitTime);
                
                // Устанавливаем обработчики событий
                const onCanPlay = () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeoutId);
                        resolve(true);
                    }
                };
                
                const onCanPlayThrough = () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeoutId);
                        resolve(true);
                    }
                };
                
                const onError = () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeoutId);
                        console.error('Ошибка загрузки видео');
                        resolve(false);
                    }
                };
                
                this.video.addEventListener('canplay', onCanPlay, { once: true });
                this.video.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
                this.video.addEventListener('error', onError, { once: true });
                
                // Переключаем на полную загрузку
                this.video.preload = 'auto';
                this.video.load();
            });
        }

        return false;
    }

    /**
     * Очищает ресурсы
     */
    cleanup() {
        if (this.video) {
            URL.revokeObjectURL(this.video.src);
            this.video = null;
        }
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement = null;
        }
        
        // Очищаем кэш кадров
        this.frameCache.clear();
        
        // Сбрасываем состояние обработки
        this.isProcessing = false;
        this.currentFrame = 0;
        this.totalFrames = 0;
        this.duration = 0;
        
        // Переинициализируем canvas
        this.init();
    }

    /**
     * Возвращает текстовое описание состояния готовности видео
     * @param {number} readyState - Состояние готовности видео
     * @returns {string} - Текстовое описание
     */
    getReadyStateText(readyState) {
        switch (readyState) {
            case 0:
                return 'HAVE_NOTHING (0) - нет данных';
            case 1:
                return 'HAVE_METADATA (1) - загружены метаданные';
            case 2:
                return 'HAVE_CURRENT_DATA (2) - загружены данные текущего кадра';
            case 3:
                return 'HAVE_FUTURE_DATA (3) - готово к воспроизведению';
            case 4:
                return 'HAVE_ENOUGH_DATA (4) - достаточно данных';
            default:
                return `неизвестное состояние (${readyState})`;
        }
    }

    /**
     * Проверяет состояние буфера видео
     * @returns {Object} - Информация о буфере
     */
    getBufferInfo() {
        if (!this.video || !this.video.buffered) {
            return { buffered: 0, duration: 0, percentage: 0 };
        }

        const buffered = this.video.buffered;
        const duration = this.video.duration;
        let bufferedEnd = 0;

        if (buffered.length > 0) {
            bufferedEnd = buffered.end(buffered.length - 1);
        }

        return {
            buffered: bufferedEnd,
            duration: duration,
            percentage: duration > 0 ? (bufferedEnd / duration) * 100 : 0
        };
    }

    /**
     * Проверяет, нужно ли загрузить больше данных
     * @param {number} currentTime - Текущее время воспроизведения
     * @returns {boolean} - true, если нужно загрузить больше данных
     */
    needsMoreData(currentTime) {
        if (!this.video || !this.video.buffered) {
            return true;
        }

        const buffered = this.video.buffered;
        const duration = this.video.duration;
        
        if (buffered.length === 0) {
            return true;
        }

        // Проверяем, есть ли данные для текущего времени + 5 секунд вперед
        const lookAhead = Math.min(currentTime + 5, duration);
        
        for (let i = 0; i < buffered.length; i++) {
            if (buffered.start(i) <= currentTime && buffered.end(i) >= lookAhead) {
                return false;
            }
        }

        return true;
    }
}

// Экспорт для использования в других модулях
window.VideoProcessor = VideoProcessor;
