/**
 * Main Application - Главное приложение ASCII Video Player
 */
class ASCIIVideoPlayerApp {
    constructor() {
        this.videoProcessor = new VideoProcessor();
        
        // Проверяем, что VideoPreprocessor загружен
        if (typeof VideoPreprocessor === 'undefined') {
            console.warn('VideoPreprocessor не загружен! Создаем заглушку...');
            // Создаем заглушку для VideoPreprocessor
            this.videoPreprocessor = {
                isPreprocessing: false,
                init: () => {},
                startPreprocessing: () => Promise.reject(new Error('VideoPreprocessor не загружен')),
                stopPreprocessing: () => {},
                cleanup: () => {},
                generateVideoId: () => 'temp',
                loadFromStorage: () => null,
                saveToStorage: () => false
            };
        } else {
            this.videoPreprocessor = new VideoPreprocessor();
        }
        this.asciiRenderer = new ASCIIRenderer();
        this.videoRecorder = new VideoRecorder();
        this.asciiFormatter = new ASCIIFormatter();
        this.currentVideo = null;
        this.isRecording = false;
        this.currentFrame = null;
        this.isPreprocessed = false;
        this.preprocessedFrames = [];
        
        // Определяем мобильное устройство
        this.isMobile = this.detectMobileDevice();
        
        this.initializeElements();
        this.bindEvents();
        this.videoProcessor.init();
        this.videoPreprocessor.init(this.videoProcessor);
        
        // Показываем предупреждение для мобильных устройств
        if (this.isMobile) {
            this.showMobileOptimizationWarning();
        }
    }

    /**
     * Определяет мобильное устройство
     */
    detectMobileDevice() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth <= 768;
        
        return isMobile || (isTouchDevice && isSmallScreen);
    }

    /**
     * Показывает предупреждение об оптимизации для мобильных устройств
     */
    showMobileOptimizationWarning() {
        this.showStatus('📱 Мобильное устройство обнаружено. Используются оптимизированные настройки для лучшей производительности.', 'info');
        
        // Автоматически устанавливаем мобильные настройки
        this.setMobileOptimizedSettings();
    }

    /**
     * Устанавливает оптимизированные настройки для мобильных устройств
     */
    setMobileOptimizedSettings() {
        if (this.isMobile) {
            // Уменьшаем размеры ASCII для мобильных
            this.widthInput.value = 60;
            this.heightInput.value = 20;
            
            // Устанавливаем среднее качество для мобильных
            this.qualitySelect.value = 'medium';
            
            // Обновляем настройки
            this.updateSettings();
            
            this.showStatus('⚡ Настройки оптимизированы для мобильного устройства', 'success');
        }
    }

    /**
     * Инициализирует DOM элементы
     */
    initializeElements() {
        // Основные элементы
        this.uploadArea = document.getElementById('uploadArea');
        this.videoInput = document.getElementById('videoInput');
        this.settingsPanel = document.getElementById('settingsPanel');
        this.asciiDisplaySection = document.getElementById('asciiDisplaySection');
        this.asciiContent = document.getElementById('asciiContent');
        this.controls = document.getElementById('controls');
        
        // Элементы прогресс-бара загрузки видео
        this.videoLoadingProgress = document.getElementById('videoLoadingProgress');
        this.loadingStatus = document.getElementById('loadingStatus');
        this.loadingProgressFill = document.getElementById('loadingProgressFill');
        this.loadingProgressText = document.getElementById('loadingProgressText');
        this.loadingTimeInfo = document.getElementById('loadingTimeInfo');
        
        // Секция выбора нового видео
        this.newVideoSection = document.getElementById('newVideoSection');
        
        
        // Кнопки управления
        this.playBtn = document.getElementById('playBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.recordBtn = document.getElementById('recordBtn');
        this.stopRecordBtn = document.getElementById('stopRecordBtn');
        this.copyFrameBtn = document.getElementById('copyFrameBtn');
        
        // Настройки
        this.qualitySelect = document.getElementById('qualitySelect');
        this.widthInput = document.getElementById('widthInput');
        this.heightInput = document.getElementById('heightInput');
        this.newVideoBtn = document.getElementById('newVideoBtn');
        this.clearCacheBtn = document.getElementById('clearCacheBtn');
        this.preprocessBtn = document.getElementById('preprocessBtn');
        
        // Элементы прогресса предобработки
        this.preprocessingProgress = document.getElementById('preprocessingProgress');
        this.preprocessingStatus = document.getElementById('preprocessingStatus');
        this.preprocessingProgressFill = document.getElementById('preprocessingProgressFill');
        this.preprocessingProgressText = document.getElementById('preprocessingProgressText');
        this.preprocessingFrameInfo = document.getElementById('preprocessingFrameInfo');
        this.cancelPreprocessingBtn = document.getElementById('cancelPreprocessingBtn');
        
        // Прогресс
        this.progressText = document.getElementById('progressText');
        this.progressFill = document.getElementById('progressFill');
        this.timeInfo = document.getElementById('timeInfo');
        
        
        // Инициализируем ASCII рендерер
        this.asciiRenderer.init(this.asciiContent, this.videoProcessor, this.videoRecorder);
    }

    /**
     * Привязывает события
     */
    bindEvents() {
        
        // Загрузка файла
        if (this.videoInput) {
            this.videoInput.addEventListener('change', (e) => this.handleFileSelect(e));
        } else {
            console.error('videoInput не найден!');
        }
        
        if (this.uploadArea) {
            this.uploadArea.addEventListener('click', () => {
                if (this.videoInput) {
                    this.videoInput.click();
                }
            });
            this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        } else {
            console.error('uploadArea не найден!');
        }
        
        // Обработчик для кнопки "Выбрать файл"
        const uploadBtn = document.querySelector('.upload-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Предотвращаем всплытие события
                this.videoInput.click();
            });
        }
        
        // Кнопки управления
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.recordBtn.addEventListener('click', () => this.startRecording());
        this.stopRecordBtn.addEventListener('click', () => this.stopRecording());
        this.copyFrameBtn.addEventListener('click', () => this.saveFrameAsPNG());
        
        // Настройки
        this.qualitySelect.addEventListener('change', () => this.updateSettings());
        this.widthInput.addEventListener('change', () => this.updateSettings());
        this.heightInput.addEventListener('change', () => this.updateSettings());
        this.newVideoBtn.addEventListener('click', () => this.selectNewVideo());
        this.clearCacheBtn.addEventListener('click', () => this.clearCache());
        this.preprocessBtn.addEventListener('click', () => this.startPreprocessing());
        this.cancelPreprocessingBtn.addEventListener('click', () => this.cancelPreprocessing());
        
    }

    /**
     * Обрабатывает выбор файла
     */
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            await this.loadVideo(file);
        }
    }

    /**
     * Обрабатывает перетаскивание файла
     */
    handleDragOver(event) {
        event.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    /**
     * Обрабатывает сброс файла
     */
    async handleDrop(event) {
        event.preventDefault();
        this.uploadArea.classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            await this.loadVideo(files[0]);
        }
    }

    /**
     * Загружает видео
     */
    async loadVideo(file) {
        try {
            this.showStatus('Загрузка видео...', 'info');
            
            // Проверяем тип файла
            if (!file.type.startsWith('video/')) {
                throw new Error('Выберите видеофайл');
            }

            // Очищаем предыдущее состояние без показа области загрузки
            this.clearVideoState();

            // Показываем прогресс-бар загрузки видео
            this.showVideoLoadingProgress();
            this.updateVideoLoadingProgress(5, 'Инициализация видео...');
            
            // Загружаем видео с отслеживанием прогресса
            this.updateVideoLoadingProgress(15, 'Загрузка метаданных...');
            const videoInfo = await this.videoProcessor.loadVideo(file, (progress, status) => {
                // Обновляем прогресс загрузки видео
                this.updateVideoLoadingProgress(15 + (progress * 0.4), status);
            });
            
            this.updateVideoLoadingProgress(60, 'Подготовка к обработке...');
            this.currentVideo = file;
            
            // Показываем информацию о загруженном видео
            const duration = Math.floor(videoInfo.duration);
            const sizeMB = (file.size / 1024 / 1024).toFixed(2);
            
            this.updateVideoLoadingProgress(70, 'Проверка готовности видео...', `${sizeMB}MB`);
            
            // Ждем полной загрузки видео
            await this.waitForVideoReady();
            
            // Финальное обновление прогресса
            this.updateVideoLoadingProgress(100, 'Видео готово к воспроизведению!', `${sizeMB}MB`);
            
            // Небольшая задержка чтобы пользователь увидел 100%
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Скрываем прогресс-бар загрузки и показываем интерфейс
            this.hideVideoLoadingProgress();
            this.showVideoInterface();
            
            // Генерируем ID видео и проверяем предобработанные данные
            const videoId = this.videoPreprocessor.generateVideoId(file);
            this.videoPreprocessor.setCurrentVideoId(videoId);
            
            // Проверяем, есть ли предобработанные данные
            const savedData = this.videoPreprocessor.loadFromStorage(videoId);
            if (savedData && this.videoPreprocessor.isSettingsCompatible(savedData.settings, this.settings)) {
                this.videoPreprocessor.preprocessedFrames = savedData.frames;
                this.showStatus(`Видео загружено: ${file.name}. Найдены предобработанные данные (${savedData.frameCount} кадров)!`, 'success');
            } else {
                this.showStatus(`Видео загружено: ${file.name}. Готово к воспроизведению!`, 'success');
            }
            
            // Обновляем элементы управления
            this.updateControls(false);
            
            this.updateProgress(100, 'Видео готово к воспроизведению');
            
        } catch (error) {
            console.error('Ошибка загрузки видео:', error);
            this.hideVideoLoadingProgress();
            this.showStatus(`Ошибка загрузки: ${error.message}`, 'error');
        }
    }

    /**
     * Обновляет настройки
     */
    updateSettings() {
        if (!this.currentVideo) return;
        
        // Оптимизируем FPS для мобильных устройств
        const fps = this.isMobile ? 15 : 30;
        
        const newSettings = {
            quality: this.qualitySelect.value,
            width: parseInt(this.widthInput.value),
            height: parseInt(this.heightInput.value),
            asciiWidth: parseInt(this.widthInput.value),
            asciiHeight: parseInt(this.heightInput.value),
            fps: fps,
            enableAudio: true, // Звук всегда включен
            isMobile: this.isMobile // Передаем информацию о мобильном устройстве
        };
        
        // Проверяем, изменились ли настройки, влияющие на предобработку
        if (this.settings && this.isPreprocessed) {
            const settingsChanged = 
                this.settings.quality !== newSettings.quality ||
                this.settings.asciiWidth !== newSettings.asciiWidth ||
                this.settings.asciiHeight !== newSettings.asciiHeight;
            
            if (settingsChanged) {
                // Сбрасываем предобработанные данные при изменении настроек
                this.isPreprocessed = false;
                this.preprocessedFrames = [];
                this.videoPreprocessor.cleanup();
                this.updatePreprocessingControls();
                this.showStatus('Настройки изменились. Требуется переобработка видео.', 'warning');
            }
        }
        
        this.settings = newSettings;
    }

    /**
     * Очищает состояние видео без показа области загрузки
     */
    clearVideoState() {
        // Останавливаем воспроизведение
        this.asciiRenderer.stop();
        
        // Очищаем ASCII контент
        if (this.asciiContent) {
            this.asciiContent.textContent = '';
        }
        
        // Сбрасываем состояние
        this.currentVideo = null;
        
        // Очищаем VideoProcessor
        this.videoProcessor.cleanup();
        
        // Очищаем VideoPreprocessor
        this.videoPreprocessor.cleanup();
        
        // Сбрасываем прогресс
        this.updateProgress(0, 'Загрузка...');
        
        // Сбрасываем элементы управления
        this.updateControls(false);
        
        // Очищаем input для возможности повторного выбора того же файла
        this.videoInput.value = '';
        
        // Скрываем только основное содержимое области загрузки, но оставляем кнопку выбора нового видео
        const uploadContent = this.uploadArea?.querySelector('.upload-content');
        if (uploadContent) {
            uploadContent.style.display = 'none';
        }
        if (this.videoLoadingProgress) {
            this.videoLoadingProgress.style.display = 'none';
        }
    }

    /**
     * Сбрасывает состояние видео и показывает область загрузки
     */
    resetVideoState() {
        // Очищаем состояние
        this.clearVideoState();
        
        // Показываем область загрузки
        this.uploadArea.style.display = 'block';
        
        // Показываем основное содержимое области загрузки
        const uploadContent = this.uploadArea.querySelector('.upload-content');
        if (uploadContent) {
            uploadContent.style.display = 'block';
        }
        
        // Скрываем кнопку выбора нового видео только при полном сбросе
        if (this.newVideoSection) {
            this.newVideoSection.style.display = 'none';
        }
        
        // Скрываем панели и прогресс-бар загрузки
        this.settingsPanel.style.display = 'none';
        this.asciiDisplaySection.style.display = 'none';
        this.controls.style.display = 'none';
        if (this.videoLoadingProgress) {
            this.videoLoadingProgress.style.display = 'none';
        }
    }

    /**
     * Сбрасывает состояние видео без скрытия кнопки выбора нового видео
     */
    resetVideoStateKeepNewVideoButton() {
        // Очищаем состояние
        this.clearVideoState();
        
        // Показываем область загрузки
        this.uploadArea.style.display = 'block';
        
        // Показываем основное содержимое области загрузки
        const uploadContent = this.uploadArea.querySelector('.upload-content');
        if (uploadContent) {
            uploadContent.style.display = 'block';
        }
        
        // НЕ скрываем кнопку выбора нового видео - она должна остаться видимой
        
        // Скрываем панели и прогресс-бар загрузки
        this.settingsPanel.style.display = 'none';
        this.asciiDisplaySection.style.display = 'none';
        this.controls.style.display = 'none';
        if (this.videoLoadingProgress) {
            this.videoLoadingProgress.style.display = 'none';
        }
    }

    /**
     * Выбирает новое видео
     */
    selectNewVideo() {
        // Полный сброс состояния с показом области загрузки
        this.resetVideoState();
        
        this.showStatus('Выберите видео', 'info');
    }

    /**
     * Ждет полной готовности видео перед началом обработки
     */
    async waitForVideoReady() {
        const maxWaitTime = 30000; // Максимум 30 секунд ожидания
        const checkInterval = 200; // Проверяем каждые 200ms
        let waited = 0;
        
        while (waited < maxWaitTime) {
            if (this.videoProcessor.video && this.videoProcessor.video.readyState >= 3) {
                return;
            }
            
            // Обновляем прогресс загрузки
            const progress = Math.min(70 + (waited / maxWaitTime) * 20, 90);
            this.updateVideoLoadingProgress(progress, `Загрузка видео... (${Math.floor(waited/1000)}с)`);
            
            // Обновляем состояние кнопок
            this.updateControls(false);
            
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waited += checkInterval;
        }
        
        // Если видео все еще не готово, выбрасываем ошибку
        throw new Error('Видео не готово к обработке после ожидания');
    }

    /**
     * Очищает кэш localStorage
     */
    clearCache() {
        try {
            // Подсчитываем количество элементов кэша
            let asciiDataCount = 0;
            let totalSize = 0;
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('ascii_preprocessed_')) {
                    asciiDataCount++;
                    const value = localStorage.getItem(key);
                    totalSize += new Blob([value]).size;
                }
            }
            
            if (asciiDataCount > 0) {
                const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
                const confirmMessage = `Удалить ${asciiDataCount} сохраненных видео (${sizeMB}MB)?`;
                if (!confirm(confirmMessage)) {
                    return;
                }
            }
            
            // Очищаем все данные ASCII
            let removedCount = 0;
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith('ascii_preprocessed_')) {
                    localStorage.removeItem(key);
                    removedCount++;
                }
            }
            
            // Очищаем текущие данные
            this.videoPreprocessor.cleanup();
            
            this.showStatus(`Кэш очищен! Удалено ${removedCount} сохраненных видео`, 'success');
            
        } catch (error) {
            this.showStatus(`Ошибка очистки кэша: ${error.message}`, 'error');
            console.error('Ошибка очистки кэша:', error);
        }
    }




    /**
     * Обновляет элементы управления предобработкой
     */
    updatePreprocessingControls() {
        // Кнопка предобработки удалена, этот метод оставлен для совместимости
        // но больше не выполняет никаких действий
    }


    /**
     * Переключает воспроизведение
     */
    togglePlay() {
        if (this.asciiRenderer.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Начинает воспроизведение
     */
    async play() {
        if (!this.currentVideo) {
            this.showStatus('Сначала выберите видео', 'warning');
            return;
        }

        try {
            this.showStatus('Начинаем воспроизведение...', 'info');
            
            const settings = this.settings || this.getDefaultSettings();
            
            // Проверяем, есть ли предобработанные данные
            if (this.hasPreprocessedData()) {
                console.log('Воспроизводим предобработанные кадры');
                const frames = this.videoPreprocessor.getPreprocessedFrames();
                this.asciiRenderer.startPreprocessedPlayback(frames, settings);
                this.showStatus('Воспроизведение предобработанного видео', 'success');
            } else {
                console.log('Воспроизводим в реальном времени');
                this.asciiRenderer.startRealtimeProcessing(settings);
                this.showStatus('Воспроизведение в реальном времени', 'success');
            }
            
            this.updateControls(true);
            this.startProgressUpdate();
            
        } catch (error) {
            this.showStatus(`Ошибка воспроизведения: ${error.message}`, 'error');
            console.error('Ошибка воспроизведения:', error);
        }
    }

    /**
     * Ставит на паузу
     */
    pause() {
        this.asciiRenderer.pause();
        this.updateControls(false);
        
        // Дополнительно обновляем состояние через небольшую задержку
        setTimeout(() => {
            this.updateControls(false);
        }, 100);
    }

    /**
     * Останавливает воспроизведение
     */
    stop() {
        this.asciiRenderer.stop();
        this.updateControls(false);
        this.updateProgress(0, 'Остановлено');
        
        // Останавливаем запись если она была активна
        if (this.isRecording) {
            this.stopRecording();
        }
    }


    /**
     * Обновляет элементы управления
     */
    updateControls(isPlaying) {
        // Проверяем готовность видео
        const isVideoReady = this.videoPreprocessor.isVideoReady();
        const hasVideo = this.currentVideo && this.videoProcessor && this.videoProcessor.video;
        
        // Для кнопки воспроизведения используем более мягкую проверку
        const canPlay = hasVideo && (isVideoReady || (this.videoProcessor.video.readyState >= 2));
        
        this.playBtn.disabled = isPlaying || !canPlay;
        this.pauseBtn.disabled = !isPlaying;
        this.stopBtn.disabled = !isPlaying;
        
        // Включаем кнопки записи и копирования только если видео загружено и готово
        this.recordBtn.disabled = !hasVideo || !isVideoReady || isPlaying;
        this.copyFrameBtn.disabled = !hasVideo || !isVideoReady;
        
        // Показываем/скрываем кнопки в зависимости от состояния
        if (isPlaying) {
            this.playBtn.style.display = 'none';
            this.pauseBtn.style.display = 'inline-flex';
        } else {
            this.playBtn.style.display = 'inline-flex';
            this.pauseBtn.style.display = 'none';
        }
        
        // Обновляем текст кнопки воспроизведения
        if (this.currentVideo) {
            // Если видео загружено, всегда показываем "Воспроизвести" или "Пауза"
            if (isPlaying) {
                this.playBtn.textContent = '▶ Воспроизвести';
            } else {
                this.playBtn.textContent = '▶ Воспроизвести';
            }
            this.playBtn.style.opacity = '1';
        } else {
            this.playBtn.textContent = '▶ Воспроизвести';
            this.playBtn.style.opacity = '1';
        }
    }

    /**
     * Запускает обновление прогресса
     */
    startProgressUpdate() {
        const updateInterval = setInterval(() => {
            if (!this.asciiRenderer.isPlaying) {
                clearInterval(updateInterval);
                return;
            }
            
            const info = this.asciiRenderer.getPlaybackInfo();
            this.updateProgress(info.progress * 100, this.formatTime(info.currentTime));
            this.timeInfo.textContent = `${this.formatTime(info.currentTime)} / ${this.formatTime(info.totalTime)}`;
        }, 100);
    }

    /**
     * Обновляет прогресс
     */
    updateProgress(percent, text) {
        this.progressFill.style.width = `${percent}%`;
        
        // Добавляем индикатор записи
        if (this.isRecording) {
            this.progressText.textContent = `🔴 ЗАПИСЬ: ${text}`;
        } else {
            this.progressText.textContent = text;
        }
    }

    /**
     * Показывает прогресс-бар загрузки видео
     */
    showVideoLoadingProgress() {
        this.uploadArea.style.display = 'none';
        this.videoLoadingProgress.style.display = 'block';
        this.updateVideoLoadingProgress(0, 'Подготовка к загрузке...');
    }

    /**
     * Скрывает прогресс-бар загрузки видео
     */
    hideVideoLoadingProgress() {
        this.videoLoadingProgress.style.display = 'none';
    }

    /**
     * Обновляет прогресс загрузки видео
     */
    updateVideoLoadingProgress(progress, status, timeInfo = '') {
        if (this.loadingProgressFill) {
            this.loadingProgressFill.style.width = `${progress}%`;
        }
        if (this.loadingStatus) {
            this.loadingStatus.textContent = status;
        }
        if (this.loadingProgressText) {
            this.loadingProgressText.textContent = `${Math.round(progress)}%`;
        }
        if (this.loadingTimeInfo) {
            this.loadingTimeInfo.textContent = timeInfo;
        }
    }

    /**
     * Показывает интерфейс видео после загрузки
     */
    showVideoInterface() {
        // Убеждаемся, что область загрузки видима
        if (this.uploadArea) {
            this.uploadArea.style.display = 'block';
        }
        
        // Скрываем основное содержимое области загрузки
        const uploadContent = this.uploadArea.querySelector('.upload-content');
        if (uploadContent) {
            uploadContent.style.display = 'none';
        }
        
        // Показываем кнопку выбора нового видео
        if (this.newVideoSection) {
            this.newVideoSection.style.display = 'flex';
        }
        
        // Показываем панель настроек
        this.settingsPanel.style.display = 'block';
        this.asciiDisplaySection.style.display = 'block';
        this.controls.style.display = 'block';
        
        // Обновляем настройки
        this.updateSettings();
    }

    /**
     * Форматирует время
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
     * Показывает статусное сообщение
     */
    showStatus(message, type = 'info') {
        const statusContainer = document.getElementById('statusMessages');
        const statusElement = document.createElement('div');
        statusElement.className = `status-message ${type}`;
        statusElement.textContent = message;
        
        statusContainer.appendChild(statusElement);
        
        // Автоматически удаляем через 5 секунд
        setTimeout(() => {
            if (statusElement.parentNode) {
                statusElement.parentNode.removeChild(statusElement);
            }
        }, 5000);
    }

    /**
     * Получает настройки по умолчанию
     */
    getDefaultSettings() {
        const fps = this.isMobile ? 15 : 30;
        const width = this.isMobile ? 60 : 120;
        const height = this.isMobile ? 20 : 40;
        const quality = this.isMobile ? 'medium' : 'high';
        
        return {
            quality: quality,
            width: width,
            height: height,
            asciiWidth: width,
            asciiHeight: height,
            fps: fps,
            enableAudio: true, // Звук всегда включен
            isMobile: this.isMobile
        };
    }

    /**
     * Начинает запись видео
     */
    async startRecording() {
        if (!this.currentVideo) {
            this.showStatus('Сначала загрузите видео', 'warning');
            return;
        }

        if (this.isRecording) {
            return;
        }

        try {
            const settings = this.settings || this.getDefaultSettings();
            
            // Инициализируем рекордер с правильными размерами ASCII
            this.videoRecorder.init(settings.asciiWidth, settings.asciiHeight, settings.fps);
            
            // Инициализируем аудио поток если включен звук
            if (settings.enableAudio && this.videoProcessor.video) {
                await this.videoRecorder.initAudioStream(this.videoProcessor.video);
            }
            
            await this.videoRecorder.startRecording();
            
            this.isRecording = true;
            this.updateRecordingControls(true);
            this.showStatus('Запись начата - нажмите "Остановить запись" для сохранения', 'success');
            
            // Начинаем воспроизведение если оно не было запущено
            if (!this.asciiRenderer.isPlaying) {
                await this.play();
            }
            
        } catch (error) {
            this.showStatus(`Ошибка начала записи: ${error.message}`, 'error');
            console.error('Ошибка записи:', error);
        }
    }

    /**
     * Останавливает запись видео
     */
    async stopRecording() {
        if (!this.isRecording) {
            return;
        }

        try {
            this.videoRecorder.stopRecording();
            this.isRecording = false;
            this.updateRecordingControls(false);
            
            this.showStatus('Запись остановлена, создаем видео...', 'info');
            
            // Экспортируем видео
            const videoBlob = await this.videoRecorder.exportMP4();
            
            // Определяем расширение файла на основе типа
            const extension = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
            const filename = `ascii_video_${Date.now()}.${extension}`;
            this.videoRecorder.downloadVideo(videoBlob, filename);
            
            this.showStatus('Видео сохранено!', 'success');
            
        } catch (error) {
            this.showStatus(`Ошибка сохранения видео: ${error.message}`, 'error');
            console.error('Ошибка сохранения:', error);
        }
    }

    /**
     * Обновляет элементы управления записью
     */
    updateRecordingControls(isRecording) {
        this.recordBtn.disabled = isRecording;
        this.stopRecordBtn.disabled = !isRecording;
        
        if (isRecording) {
            this.recordBtn.innerHTML = '<span class="btn-icon">🔴</span><span class="btn-text">Запись...</span>';
        } else {
            this.recordBtn.innerHTML = '<span class="btn-icon">🔴</span><span class="btn-text">Записать MP4</span>';
        }
    }

    /**
     * Получает текущий ASCII кадр
     */
    getCurrentFrame() {
        if (!this.currentVideo) {
            this.showStatus('Сначала загрузите видео', 'warning');
            return null;
        }

        // Получаем текущий кадр
        this.currentFrame = this.asciiContent.textContent;
        
        if (!this.currentFrame || this.currentFrame.trim().length === 0) {
            this.showStatus('Нет кадра для сохранения. Сначала воспроизведите видео', 'warning');
            return null;
        }

        return this.currentFrame;
    }


    /**
     * Сохраняет текущий ASCII кадр как PNG изображение
     */
    async saveFrameAsPNG() {
        const frame = this.getCurrentFrame();
        if (!frame) {
            return;
        }

        try {
            this.showStatus('Создание PNG изображения...', 'info');
            
            // Создаем canvas для рендеринга ASCII
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            // Настройки шрифта и размеров
            const fontSize = 12;
            const lineHeight = 14;
            const charWidth = 8;
            
            // Разбиваем ASCII на строки
            const lines = frame.split('\n');
            const maxLineLength = Math.max(...lines.map(line => line.length));
            
            // Вычисляем размеры canvas
            const canvasWidth = maxLineLength * charWidth;
            const canvasHeight = lines.length * lineHeight;
            
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            
            // Настраиваем контекст
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            ctx.fillStyle = '#ffffff';
            ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
            ctx.textBaseline = 'top';
            
            // Рендерим каждую строку
            for (let y = 0; y < lines.length; y++) {
                const line = lines[y];
                const yPos = y * lineHeight;
                
                for (let x = 0; x < line.length; x++) {
                    const char = line[x];
                    const xPos = x * charWidth;
                    ctx.fillText(char, xPos, yPos);
                }
            }
            
            // Конвертируем canvas в PNG blob
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png', 1.0);
            });
            
            // Скачиваем файл
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `ascii_frame_${timestamp}.png`;
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showStatus(`Кадр сохранен как ${filename}`, 'success');
            
        } catch (error) {
            this.showStatus(`Ошибка сохранения кадра: ${error.message}`, 'error');
            console.error('Ошибка сохранения кадра:', error);
        }
    }

    /**
     * Начинает предобработку видео
     */
    async startPreprocessing() {
        if (!this.currentVideo) {
            this.showStatus('Сначала загрузите видео', 'warning');
            return;
        }

        if (this.videoPreprocessor.isPreprocessing) {
            this.showStatus('Предобработка уже выполняется', 'warning');
            return;
        }

        try {
            const settings = this.settings || this.getDefaultSettings();
            
            // Генерируем ID видео
            const videoId = this.videoPreprocessor.generateVideoId(this.currentVideo);
            this.videoPreprocessor.setCurrentVideoId(videoId);
            
            // Показываем прогресс предобработки
            this.showPreprocessingProgress();
            
            // Запускаем предобработку
            await this.videoPreprocessor.startPreprocessing(
                settings,
                (progress, status) => this.updatePreprocessingProgress(progress, status),
                (frames) => this.onPreprocessingComplete(frames),
                (error) => this.onPreprocessingError(error)
            );
            
        } catch (error) {
            this.hidePreprocessingProgress();
            this.showStatus(`Ошибка предобработки: ${error.message}`, 'error');
            console.error('Ошибка предобработки:', error);
        }
    }

    /**
     * Отменяет предобработку
     */
    cancelPreprocessing() {
        if (this.videoPreprocessor.isPreprocessing) {
            this.videoPreprocessor.stopPreprocessing();
            this.hidePreprocessingProgress();
            this.showStatus('Предобработка отменена', 'info');
        }
    }

    /**
     * Показывает прогресс предобработки
     */
    showPreprocessingProgress() {
        this.preprocessingProgress.style.display = 'block';
        this.asciiDisplaySection.style.display = 'none';
        this.controls.style.display = 'none';
        this.updatePreprocessingProgress(0, 'Подготовка к обработке...');
    }

    /**
     * Скрывает прогресс предобработки
     */
    hidePreprocessingProgress() {
        this.preprocessingProgress.style.display = 'none';
    }

    /**
     * Обновляет прогресс предобработки
     */
    updatePreprocessingProgress(progress, status) {
        if (this.preprocessingProgressFill) {
            this.preprocessingProgressFill.style.width = `${progress}%`;
        }
        if (this.preprocessingStatus) {
            this.preprocessingStatus.textContent = status;
        }
        if (this.preprocessingProgressText) {
            this.preprocessingProgressText.textContent = `${Math.round(progress)}%`;
        }
        
        // Обновляем информацию о кадрах
        if (status.includes('кадров')) {
            const match = status.match(/(\d+) из (\d+) кадров/);
            if (match) {
                this.preprocessingFrameInfo.textContent = `${match[1]} / ${match[2]} кадров`;
            }
        }
    }

    /**
     * Обработчик завершения предобработки
     */
    onPreprocessingComplete(frames) {
        this.hidePreprocessingProgress();
        this.showVideoInterface();
        this.updateControls(false);
        this.showStatus(`Предобработка завершена! Обработано ${frames.length} кадров`, 'success');
    }

    /**
     * Обработчик ошибки предобработки
     */
    onPreprocessingError(error) {
        this.hidePreprocessingProgress();
        this.showStatus(`Ошибка предобработки: ${error.message}`, 'error');
        console.error('Ошибка предобработки:', error);
    }

    /**
     * Проверяет, есть ли предобработанные данные
     */
    hasPreprocessedData() {
        return this.videoPreprocessor.hasPreprocessedData();
    }
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    
    // Проверяем, что основные классы загружены
    const requiredClasses = ['VideoProcessor', 'ASCIIRenderer', 'VideoRecorder', 'ASCIIFormatter'];
    const missingClasses = requiredClasses.filter(className => typeof window[className] === 'undefined');
    
    if (missingClasses.length > 0) {
        console.error('Не загружены основные классы:', missingClasses);
        alert(`Ошибка загрузки: не найдены классы ${missingClasses.join(', ')}. Обновите страницу (Ctrl+F5)`);
        return;
    }
    
    // VideoPreprocessor опционален
    if (typeof VideoPreprocessor === 'undefined') {
        console.warn('VideoPreprocessor не загружен - функция предобработки недоступна');
    }
    
    try {
        window.app = new ASCIIVideoPlayerApp();
    } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
        alert('Ошибка инициализации приложения. Проверьте консоль для подробностей.');
    }
});