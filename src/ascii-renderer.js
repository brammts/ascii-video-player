/**
 * ASCII Renderer - Рендеринг ASCII контента
 */
class ASCIIRenderer {
    constructor() {
        this.container = null;
        this.isPlaying = false;
        this.currentFrame = 0;
        this.frames = [];
        this.animationId = null;
        this.startTime = 0;
        this.fps = 30;
        this.frameDelay = 1000 / 30; // 30 FPS по умолчанию
        this.videoProcessor = null; // Ссылка на процессор видео для звука
        this.isRealtime = false; // Флаг для режима реального времени
        this.currentTime = 0; // Текущее время воспроизведения
        this.duration = 0; // Длительность видео
        this.settings = null; // Настройки обработки
        this.videoRecorder = null; // Ссылка на рекордер для записи
        this.lastReadyStateWarning = 0; // Для throttling сообщений о readyState
        this.readyStateWarningInterval = 2000; // Интервал между предупреждениями (2 секунды)
    }

    /**
     * Инициализирует рендерер
     * @param {HTMLElement} container - Контейнер для ASCII контента
     * @param {VideoProcessor} videoProcessor - Процессор видео для звука
     * @param {VideoRecorder} videoRecorder - Рекордер для записи видео
     */
    init(container, videoProcessor = null, videoRecorder = null) {
        this.container = container;
        this.videoProcessor = videoProcessor;
        this.videoRecorder = videoRecorder;
    }

    /**
     * Устанавливает ASCII кадры для воспроизведения
     * @param {Array} frames - Массив ASCII кадров
     * @param {number} fps - FPS воспроизведения
     */
    setFrames(frames, fps = 30) {
        this.frames = frames;
        this.fps = fps;
        this.frameDelay = 1000 / fps;
        this.currentFrame = 0;
        this.isRealtime = false;
    }

    /**
     * Запускает обработку в реальном времени
     * @param {Object} settings - Настройки обработки
     */
    async startRealtimeProcessing(settings) {
        if (!this.videoProcessor || !this.container) {
            throw new Error('Рендерер не инициализирован');
        }

        // Дополнительная проверка готовности видео
        if (!this.videoProcessor.video || this.videoProcessor.video.readyState < 4) {
            const readyStateText = this.videoProcessor.video ? 
                this.getReadyStateText(this.videoProcessor.video.readyState) : 
                'видео не загружено';
            console.log(`ASCII Renderer: Видео не готово (${readyStateText})`);
            throw new Error(`Видео не готово для воспроизведения (${readyStateText})`);
        }
        
        console.log(`ASCII Renderer: Видео готово. readyState: ${this.videoProcessor.video.readyState} (${this.getReadyStateText(this.videoProcessor.video.readyState)})`);

        this.settings = settings;
        this.isRealtime = true;
        this.fps = settings.fps || 30;
        this.frameDelay = 1000 / this.fps;
        this.duration = this.videoProcessor.duration;
        this.currentTime = 0;
        this.currentFrame = 0;
        this.frames = []; // Очищаем предобработанные кадры

        this.isPlaying = true;
        this.startTime = performance.now();
        
        // Запускаем звук
        if (this.videoProcessor) {
            this.videoProcessor.playAudio();
        }
        
        // Запускаем рендеринг в реальном времени
        this.renderRealtime();
    }

    /**
     * Запускает воспроизведение предобработанных кадров
     * @param {Array} frames - Массив ASCII кадров
     * @param {Object} settings - Настройки воспроизведения
     */
    startPreprocessedPlayback(frames, settings) {
        if (!this.container) {
            throw new Error('Рендерер не инициализирован');
        }

        if (!frames || frames.length === 0) {
            throw new Error('Нет кадров для воспроизведения');
        }

        console.log(`ASCII Renderer: Начинаем воспроизведение ${frames.length} предобработанных кадров`);

        this.settings = settings;
        this.isRealtime = false;
        this.frames = frames;
        this.fps = settings.fps || 30;
        this.frameDelay = 1000 / this.fps;
        this.duration = frames.length / this.fps;
        this.currentTime = 0;
        this.currentFrame = 0;

        this.isPlaying = true;
        this.startTime = performance.now();
        
        // Запускаем звук
        if (this.videoProcessor) {
            this.videoProcessor.playAudio();
        }
        
        // Запускаем рендеринг предобработанных кадров
        this.render();
    }

    /**
     * Начинает воспроизведение
     */
    play() {
        if (this.isPlaying || this.frames.length === 0) {
            return;
        }

        this.isPlaying = true;
        this.startTime = performance.now();
        this.currentFrame = 0;
        
        // Запускаем звук
        if (this.videoProcessor) {
            this.videoProcessor.playAudio();
        }
        
        this.render();
    }

    /**
     * Останавливает воспроизведение
     */
    stop() {
        this.isPlaying = false;
        this.isRealtime = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Останавливаем звук
        if (this.videoProcessor) {
            this.videoProcessor.stopAudio();
        }
        
        this.currentFrame = 0;
        this.currentTime = 0;
        
        // Очищаем контент
        if (this.container) {
            this.container.textContent = '';
        }
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
                return 'HAVE_METADATA (1) - загружаются метаданные';
            case 2:
                return 'HAVE_CURRENT_DATA (2) - загружаются данные текущего кадра';
            case 3:
                return 'HAVE_FUTURE_DATA (3) - готово к воспроизведению';
            case 4:
                return 'HAVE_ENOUGH_DATA (4) - достаточно данных для воспроизведения';
            default:
                return `неизвестное состояние (${readyState})`;
        }
    }

    /**
     * Ставит на паузу
     */
    pause() {
        this.isPlaying = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Пауза звука
        if (this.videoProcessor) {
            this.videoProcessor.stopAudio();
        }
    }

    /**
     * Возобновляет воспроизведение
     */
    resume() {
        if (this.frames.length === 0) {
            return;
        }

        this.isPlaying = true;
        this.startTime = performance.now() - (this.currentFrame * this.frameDelay);
        
        // Возобновляем звук
        if (this.videoProcessor) {
            this.videoProcessor.playAudio();
        }
        
        this.render();
    }

    /**
     * Рендерит текущий кадр
     */
    render() {
        if (!this.container || this.frames.length === 0) {
            return;
        }

        // Отображаем текущий кадр
        const frame = this.frames[this.currentFrame];
        if (frame) {
            this.container.textContent = frame;
        }

        if (this.isPlaying) {
            // Вычисляем время до следующего кадра
            const elapsed = performance.now() - this.startTime;
            const expectedFrame = Math.floor(elapsed / this.frameDelay);
            
            if (expectedFrame >= this.frames.length) {
                // Видео закончилось, перезапускаем
                this.currentFrame = 0;
                this.startTime = performance.now();
                
                // Перезапускаем звук
                if (this.videoProcessor) {
                    this.videoProcessor.playAudio();
                }
            } else {
                this.currentFrame = expectedFrame;
                
                // Синхронизируем звук
                if (this.videoProcessor) {
                    const currentTime = this.currentFrame / this.fps;
                    this.videoProcessor.syncAudio(currentTime);
                }
            }

            // Планируем следующий кадр
            this.animationId = requestAnimationFrame(() => this.render());
        }
    }

    /**
     * Рендерит кадры в реальном времени
     */
    async renderRealtime() {
        if (!this.container || !this.isPlaying || !this.isRealtime) {
            return;
        }

        try {
            const frameStartTime = performance.now();
            
            // Вычисляем текущее время
            const elapsed = performance.now() - this.startTime;
            this.currentTime = elapsed / 1000;
            
            // Оптимизация для мобильных устройств - пропускаем кадры при низкой производительности
            if (this.settings && this.settings.isMobile) {
                const frameTime = performance.now() - frameStartTime;
                if (frameTime > 100) { // Если обработка кадра заняла больше 100мс
                    // Пропускаем этот кадр для мобильных устройств
                    setTimeout(() => {
                        if (this.isPlaying && this.isRealtime) {
                            this.animationId = requestAnimationFrame(() => this.renderRealtime());
                        }
                    }, this.frameDelay);
                    return;
                }
            }

            // Проверяем, не закончилось ли видео
            if (this.currentTime >= this.duration) {
                // Видео закончилось, перезапускаем
                this.currentTime = 0;
                this.startTime = performance.now();
                
                // Перезапускаем звук
                if (this.videoProcessor) {
                    this.videoProcessor.playAudio();
                }
            }

            // Адаптируем качество на основе производительности
            const adaptedSettings = this.videoProcessor.adaptQuality(
                performance.now() - frameStartTime, 
                this.settings
            );

            // Проверяем готовность видео перед извлечением кадра
            if (!this.videoProcessor.video) {
                this.stop();
                return;
            }
            
            // Если видео не готово для воспроизведения, ждем
            // if (this.videoProcessor.video.readyState < 4) {
            //     const now = Date.now();
            //     // Показываем предупреждение не чаще чем раз в 2 секунды
            //     if (now - this.lastReadyStateWarning > this.readyStateWarningInterval) {
            //         const readyStateText = this.getReadyStateText(this.videoProcessor.video.readyState);
            //         const bufferInfo = this.videoProcessor.getBufferInfo();
            //         console.log(`Видео не готово для воспроизведения (${readyStateText}), буфер: ${bufferInfo.percentage.toFixed(1)}%, ждем...`);
            //         this.lastReadyStateWarning = now;
            //     }
                
            //     // Пытаемся загрузить больше данных
            //     if (this.videoProcessor.video.readyState >= 1) {
            //         this.videoProcessor.video.load();
            //     }
                
            //     // Увеличиваем задержку для следующего кадра
            //     setTimeout(() => {
            //         if (this.isPlaying && this.isRealtime) {
            //             this.animationId = requestAnimationFrame(() => this.renderRealtime());
            //         }
            //     }, this.frameDelay * 3);
            //     return;
            // }
            
            // // Проверяем, нужно ли загрузить больше данных
            // if (this.videoProcessor.needsMoreData(this.currentTime)) {
            //     this.videoProcessor.video.load();
            // }
            
            // // Сбрасываем счетчик предупреждений, если видео готово
            // this.lastReadyStateWarning = 0;

            try {
                // Извлекаем и обрабатываем кадр в реальном времени
                const imageData = await this.videoProcessor.extractFrame(
                    this.currentTime, 
                    adaptedSettings.asciiWidth, 
                    adaptedSettings.asciiHeight
                );
                
                const asciiFrame = this.videoProcessor.convertToASCII(imageData, adaptedSettings);
                
                // Сбрасываем счетчик предупреждений при успешном извлечении кадра
                this.lastReadyStateWarning = 0;
                
                // Отображаем кадр только если он изменился
                if (this.container.textContent !== asciiFrame) {
                    this.container.textContent = asciiFrame;
                }
                
                // Записываем кадр если включена запись
                if (this.videoRecorder && this.videoRecorder.isRecording) {
                    this.videoRecorder.addFrame(asciiFrame, adaptedSettings.asciiWidth, adaptedSettings.asciiHeight, this.currentTime);
                }
                
            } catch (error) {
                console.warn('Ошибка извлечения кадра в реальном времени:', error.message);
                // Показываем пустой кадр при ошибке
                if (this.container) {
                    this.container.textContent = this.videoProcessor.createEmptyFrame(
                        adaptedSettings.asciiWidth, 
                        adaptedSettings.asciiHeight
                    );
                }
            }
            
            // Синхронизируем звук
            if (this.videoProcessor) {
                this.videoProcessor.syncAudio(this.currentTime);
            }

            // Планируем следующий кадр с ограничением FPS
            if (this.isPlaying && this.isRealtime) {
                const frameTime = performance.now() - frameStartTime;
                let delay = Math.max(0, this.frameDelay - frameTime);
                
                // Дополнительная задержка для мобильных устройств для экономии батареи
                if (this.settings && this.settings.isMobile) {
                    delay = Math.max(delay, 50); // Минимум 50мс между кадрами на мобильных
                }
                
                // Используем setTimeout для контроля FPS
                setTimeout(() => {
                    if (this.isPlaying && this.isRealtime) {
                        this.animationId = requestAnimationFrame(() => this.renderRealtime());
                    }
                }, delay);
            }
            
        } catch (error) {
            console.error('Ошибка рендеринга в реальном времени:', error);
            
            // В случае ошибки показываем пустой кадр
            if (this.container) {
                this.container.textContent = this.videoProcessor.createEmptyFrame(
                    this.settings.asciiWidth, 
                    this.settings.asciiHeight
                );
            }
            
            // Продолжаем рендеринг с задержкой при ошибке
            if (this.isPlaying && this.isRealtime) {
                setTimeout(() => {
                    if (this.isPlaying && this.isRealtime) {
                        this.animationId = requestAnimationFrame(() => this.renderRealtime());
                    }
                }, 100); // Задержка при ошибке
            }
        }
    }

    /**
     * Устанавливает текущий кадр
     * @param {number} frameIndex - Индекс кадра
     */
    setFrame(frameIndex) {
        if (frameIndex >= 0 && frameIndex < this.frames.length) {
            this.currentFrame = frameIndex;
            this.render();
        }
    }

    /**
     * Получает информацию о воспроизведении
     * @returns {Object} - Информация о воспроизведении
     */
    getPlaybackInfo() {
        if (this.isRealtime) {
            // Для режима реального времени
            const progress = this.duration > 0 ? this.currentTime / this.duration : 0;
            return {
                currentFrame: Math.floor(this.currentTime * this.fps),
                totalFrames: Math.floor(this.duration * this.fps),
                currentTime: this.currentTime,
                totalTime: this.duration,
                progress: progress,
                isPlaying: this.isPlaying,
                fps: this.fps
            };
        } else {
            // Для предобработанных кадров
            const currentTime = this.currentFrame * this.frameDelay / 1000;
            const totalTime = this.frames.length * this.frameDelay / 1000;
            const progress = this.frames.length > 0 ? this.currentFrame / this.frames.length : 0;

            return {
                currentFrame: this.currentFrame,
                totalFrames: this.frames.length,
                currentTime: currentTime,
                totalTime: totalTime,
                progress: progress,
                isPlaying: this.isPlaying,
                fps: this.fps
            };
        }
    }

    /**
     * Очищает рендерер
     */
    cleanup() {
        this.stop();
        this.frames = [];
        this.container = null;
    }
}

// Экспорт для использования в других модулях
window.ASCIIRenderer = ASCIIRenderer;
