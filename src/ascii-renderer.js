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

            // Извлекаем и обрабатываем кадр в реальном времени
            const imageData = await this.videoProcessor.extractFrame(
                this.currentTime, 
                adaptedSettings.asciiWidth, 
                adaptedSettings.asciiHeight
            );
            
            const asciiFrame = this.videoProcessor.convertToASCII(imageData, adaptedSettings);
            
            // Отображаем кадр только если он изменился
            if (this.container.textContent !== asciiFrame) {
                this.container.textContent = asciiFrame;
            }
            
            // Записываем кадр если включена запись
            if (this.videoRecorder && this.videoRecorder.isRecording) {
                this.videoRecorder.addFrame(asciiFrame, adaptedSettings.asciiWidth, adaptedSettings.asciiHeight, this.currentTime);
            }
            
            // Синхронизируем звук
            if (this.videoProcessor) {
                this.videoProcessor.syncAudio(this.currentTime);
            }

            // Планируем следующий кадр с ограничением FPS
            if (this.isPlaying && this.isRealtime) {
                const frameTime = performance.now() - frameStartTime;
                const delay = Math.max(0, this.frameDelay - frameTime);
                
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
