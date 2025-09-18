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
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * Загружает видеофайл
     * @param {File} file - Видеофайл
     * @returns {Promise<Object>} - Информация о видео
     */
    async loadVideo(file) {
        // Очищаем предыдущее состояние
        this.cleanup();
        
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = false; // Включаем звук
            
            video.onloadedmetadata = () => {
                this.video = video;
                this.fps = 30; // Базовый FPS
                this.duration = video.duration;
                this.totalFrames = Math.floor(video.duration * this.fps);
                
                // Создаем отдельный аудио элемент для воспроизведения
                this.audioElement = video.cloneNode();
                this.audioElement.muted = false;
                this.audioElement.volume = 0.7;
                
                resolve({
                    duration: video.duration,
                    width: video.videoWidth,
                    height: video.videoHeight,
                    fps: this.fps,
                    totalFrames: this.totalFrames
                });
            };
            
            video.onerror = (error) => {
                reject(new Error('Ошибка загрузки видео: ' + error.message));
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
        
        // Извлекаем кадр
        const imageData = await this.extractFrameInternal(time, width, height);
        
        // Сохраняем в кэш
        this.frameCache.set(cacheKey, imageData);
        
        return imageData;
    }

    /**
     * Внутренний метод извлечения кадра
     * @param {number} time - Время в секундах
     * @param {number} width - Ширина кадра
     * @param {number} height - Высота кадра
     * @returns {Promise<ImageData>} - Данные кадра
     */
    async extractFrameInternal(time, width, height) {
        if (!this.video) {
            throw new Error('Видео не загружено');
        }

        // Проверяем валидность времени
        if (time < 0 || time > this.duration) {
            throw new Error(`Некорректное время кадра: ${time}. Длительность видео: ${this.duration}`);
        }

        return new Promise((resolve, reject) => {
            // Используем оригинальное видео, а не клон
            const video = this.video;
            const originalTime = video.currentTime;
            
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
            
            // Таймаут для предотвращения зависания
            timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    reject(new Error('Таймаут извлечения кадра'));
                }
            }, 3000); // Уменьшаем таймаут до 3 секунд
            
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
                reject(new Error('Ошибка извлечения кадра: ' + error.message));
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
}

// Экспорт для использования в других модулях
window.VideoProcessor = VideoProcessor;
