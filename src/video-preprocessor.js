/**
 * Video Preprocessor - Предварительная обработка видео в ASCII кадры
 */
class VideoPreprocessor {
    constructor() {
        this.videoProcessor = null;
        this.settings = null;
        this.isPreprocessing = false;
        this.preprocessedFrames = [];
        this.currentVideoId = null;
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
    }

    /**
     * Инициализирует предпроцессор
     * @param {VideoProcessor} videoProcessor - Процессор видео
     */
    init(videoProcessor) {
        this.videoProcessor = videoProcessor;
    }

    /**
     * Проверяет готовность видео для воспроизведения
     * @returns {boolean} - true если видео готово
     */
    isVideoReady() {
        return this.videoProcessor && 
               this.videoProcessor.video && 
               this.videoProcessor.video.readyState >= 2; // HAVE_CURRENT_DATA
    }

    /**
     * Получает информацию о видео
     * @returns {Object} - Информация о видео
     */
    getVideoInfo() {
        if (!this.videoProcessor || !this.videoProcessor.video) {
            return null;
        }
        
        return {
            duration: this.videoProcessor.duration,
            width: this.videoProcessor.video.videoWidth,
            height: this.videoProcessor.video.videoHeight,
            fps: 30, // По умолчанию
            readyState: this.videoProcessor.video.readyState
        };
    }

    /**
     * Генерирует уникальный ID для видео
     * @param {File} file - Файл видео
     * @returns {string} - Уникальный ID
     */
    generateVideoId(file) {
        return `${file.name}_${file.size}_${file.lastModified}`.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    /**
     * Начинает предварительную обработку видео
     * @param {Object} settings - Настройки обработки
     * @param {Function} onProgress - Callback для отслеживания прогресса
     * @param {Function} onComplete - Callback при завершении
     * @param {Function} onError - Callback при ошибке
     * @returns {Promise<Array>} - Массив ASCII кадров
     */
    async startPreprocessing(settings, onProgress = null, onComplete = null, onError = null) {
        if (this.isPreprocessing) {
            throw new Error('Предобработка уже выполняется');
        }

        if (!this.videoProcessor || !this.videoProcessor.video) {
            throw new Error('Видео не загружено');
        }

        this.settings = settings;
        this.onProgress = onProgress;
        this.onComplete = onComplete;
        this.onError = onError;
        this.isPreprocessing = true;
        this.preprocessedFrames = [];

        try {
            const videoInfo = this.getVideoInfo();
            const totalFrames = Math.floor(videoInfo.duration * settings.fps);
            
            console.log(`Начинаем предобработку: ${totalFrames} кадров, ${videoInfo.duration}с, ${settings.fps} FPS`);

            // Проверяем, есть ли уже сохраненные данные
            const savedData = this.loadFromStorage(this.currentVideoId);
            if (savedData && this.isSettingsCompatible(savedData.settings, settings)) {
                console.log('Найдены сохраненные данные, загружаем...');
                this.preprocessedFrames = savedData.frames;
                this.isPreprocessing = false;
                if (this.onComplete) {
                    this.onComplete(this.preprocessedFrames);
                }
                return this.preprocessedFrames;
            }

            // Обрабатываем каждый кадр
            for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
                if (!this.isPreprocessing) {
                    throw new Error('Предобработка прервана');
                }

                const currentTime = frameIndex / settings.fps;
                
                try {
                    // Извлекаем кадр
                    const imageData = await this.videoProcessor.extractFrame(
                        currentTime,
                        settings.asciiWidth,
                        settings.asciiHeight
                    );
                    
                    // Конвертируем в ASCII
                    const asciiFrame = this.videoProcessor.convertToASCII(imageData, settings);
                    this.preprocessedFrames.push(asciiFrame);
                    
                    // Обновляем прогресс
                    const progress = ((frameIndex + 1) / totalFrames) * 100;
                    if (this.onProgress) {
                        this.onProgress(progress, `Обработано ${frameIndex + 1} из ${totalFrames} кадров`);
                    }
                    
                    // Сохраняем промежуточные результаты каждые 100 кадров
                    if ((frameIndex + 1) % 100 === 0) {
                        this.saveToStorage(this.currentVideoId, this.preprocessedFrames, settings);
                    }
                    
                } catch (error) {
                    console.warn(`Ошибка обработки кадра ${frameIndex}:`, error);
                    // Добавляем пустой кадр при ошибке
                    this.preprocessedFrames.push(this.videoProcessor.createEmptyFrame(
                        settings.asciiWidth,
                        settings.asciiHeight
                    ));
                }
            }

            // Сохраняем финальный результат
            this.saveToStorage(this.currentVideoId, this.preprocessedFrames, settings);
            
            this.isPreprocessing = false;
            if (this.onComplete) {
                this.onComplete(this.preprocessedFrames);
            }
            
            console.log(`Предобработка завершена: ${this.preprocessedFrames.length} кадров`);
            return this.preprocessedFrames;

        } catch (error) {
            this.isPreprocessing = false;
            console.error('Ошибка предобработки:', error);
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        }
    }

    /**
     * Останавливает предобработку
     */
    stopPreprocessing() {
        this.isPreprocessing = false;
    }

    /**
     * Проверяет совместимость настроек
     * @param {Object} savedSettings - Сохраненные настройки
     * @param {Object} currentSettings - Текущие настройки
     * @returns {boolean} - true если настройки совместимы
     */
    isSettingsCompatible(savedSettings, currentSettings) {
        return savedSettings.asciiWidth === currentSettings.asciiWidth &&
               savedSettings.asciiHeight === currentSettings.asciiHeight &&
               savedSettings.quality === currentSettings.quality;
    }

    /**
     * Сохраняет данные в localStorage
     * @param {string} videoId - ID видео
     * @param {Array} frames - Массив ASCII кадров
     * @param {Object} settings - Настройки
     * @returns {boolean} - true если сохранение успешно
     */
    saveToStorage(videoId, frames, settings) {
        try {
            const storageKey = `ascii_preprocessed_${videoId}`;
            const data = {
                frames: frames,
                settings: settings,
                timestamp: Date.now(),
                frameCount: frames.length
            };
            
            // Проверяем размер данных
            const dataString = JSON.stringify(data);
            const dataSize = new Blob([dataString]).size;
            const maxSize = 50 * 1024 * 1024; // 50MB максимум
            
            if (dataSize > maxSize) {
                console.warn('Данные слишком большие для сохранения в localStorage');
                return false;
            }
            
            localStorage.setItem(storageKey, dataString);
            console.log(`Сохранено в localStorage: ${(dataSize / 1024 / 1024).toFixed(2)}MB`);
            return true;
            
        } catch (error) {
            console.error('Ошибка сохранения в localStorage:', error);
            return false;
        }
    }

    /**
     * Загружает данные из localStorage
     * @param {string} videoId - ID видео
     * @returns {Object|null} - Данные или null
     */
    loadFromStorage(videoId) {
        try {
            const storageKey = `ascii_preprocessed_${videoId}`;
            const dataString = localStorage.getItem(storageKey);
            
            if (!dataString) {
                return null;
            }
            
            const data = JSON.parse(dataString);
            
            // Проверяем актуальность данных (не старше 7 дней)
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 дней в миллисекундах
            if (Date.now() - data.timestamp > maxAge) {
                localStorage.removeItem(storageKey);
                return null;
            }
            
            console.log(`Загружено из localStorage: ${data.frameCount} кадров`);
            return data;
            
        } catch (error) {
            console.error('Ошибка загрузки из localStorage:', error);
            return null;
        }
    }

    /**
     * Устанавливает ID текущего видео
     * @param {string} videoId - ID видео
     */
    setCurrentVideoId(videoId) {
        this.currentVideoId = videoId;
    }

    /**
     * Получает предобработанные кадры
     * @returns {Array} - Массив ASCII кадров
     */
    getPreprocessedFrames() {
        return this.preprocessedFrames;
    }

    /**
     * Проверяет, есть ли предобработанные данные
     * @returns {boolean} - true если есть данные
     */
    hasPreprocessedData() {
        return this.preprocessedFrames.length > 0;
    }

    /**
     * Очищает состояние
     */
    cleanup() {
        this.isPreprocessing = false;
        this.preprocessedFrames = [];
        this.currentVideoId = null;
        this.settings = null;
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
    }
}

// Экспорт для использования в других модулях
window.VideoPreprocessor = VideoPreprocessor;
