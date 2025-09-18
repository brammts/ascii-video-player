/**
 * Main Application - Главное приложение ASCII Video Player
 */
class ASCIIVideoPlayerApp {
    constructor() {
        this.videoProcessor = new VideoProcessor();
        this.asciiRenderer = new ASCIIRenderer();
        this.videoRecorder = new VideoRecorder();
        this.asciiFormatter = new ASCIIFormatter();
        this.currentVideo = null;
        this.isRecording = false;
        this.currentFrame = null;
        
        // Определяем мобильное устройство
        this.isMobile = this.detectMobileDevice();
        
        this.initializeElements();
        this.bindEvents();
        this.videoProcessor.init();
        
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
        this.videoInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.uploadArea.addEventListener('click', () => this.videoInput.click());
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
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

            // Загружаем видео
            const videoInfo = await this.videoProcessor.loadVideo(file);
            this.currentVideo = file;
            
            // Скрываем область загрузки
            this.uploadArea.style.display = 'none';
            
            // Отключаем кнопку "Выбрать файл" в HTML
            const uploadBtn = document.querySelector('.upload-btn');
            if (uploadBtn) {
                uploadBtn.style.display = 'none';
            }
            
            // Показываем панель настроек
            this.settingsPanel.style.display = 'block';
            this.asciiDisplaySection.style.display = 'block';
            this.controls.style.display = 'block';
            
            // Обновляем настройки
            this.updateSettings();
            
            this.showStatus(`Видео загружено: ${file.name}`, 'success');
            
        } catch (error) {
            this.showStatus(`Ошибка загрузки: ${error.message}`, 'error');
            console.error('Ошибка загрузки видео:', error);
        }
    }

    /**
     * Обновляет настройки
     */
    updateSettings() {
        if (!this.currentVideo) return;
        
        // Оптимизируем FPS для мобильных устройств
        const fps = this.isMobile ? 15 : 30;
        
        const settings = {
            quality: this.qualitySelect.value,
            width: parseInt(this.widthInput.value),
            height: parseInt(this.heightInput.value),
            asciiWidth: parseInt(this.widthInput.value),
            asciiHeight: parseInt(this.heightInput.value),
            fps: fps,
            enableAudio: true, // Звук всегда включен
            isMobile: this.isMobile // Передаем информацию о мобильном устройстве
        };
        
        this.settings = settings;
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
        
        // Сбрасываем прогресс
        this.updateProgress(0, 'Загрузка...');
        
        // Сбрасываем элементы управления
        this.updateControls(false);
        
        // Очищаем input для возможности повторного выбора того же файла
        this.videoInput.value = '';
        
        // Убеждаемся, что область загрузки скрыта
        if (this.uploadArea) {
            this.uploadArea.style.display = 'none';
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
        
        // Показываем кнопку "Выбрать файл"
        const uploadBtn = document.querySelector('.upload-btn');
        if (uploadBtn) {
            uploadBtn.style.display = 'block';
        }
        
        // Скрываем панели
        this.settingsPanel.style.display = 'none';
        this.asciiDisplaySection.style.display = 'none';
        this.controls.style.display = 'none';
    }

    /**
     * Выбирает новое видео
     */
    selectNewVideo() {
        // Полный сброс состояния с показом области загрузки
        this.resetVideoState();
        
        this.showStatus('Выберите новое видео', 'info');
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
            
            // Запускаем обработку в реальном времени
            this.asciiRenderer.startRealtimeProcessing(settings);
            this.updateControls(true);
            this.startProgressUpdate();
            
            this.showStatus('Воспроизведение начато', 'success');
            
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
        this.playBtn.disabled = isPlaying;
        this.pauseBtn.disabled = !isPlaying;
        this.stopBtn.disabled = !isPlaying;
        
        // Включаем кнопки записи и копирования только если видео загружено
        this.recordBtn.disabled = !this.currentVideo || isPlaying;
        this.copyFrameBtn.disabled = !this.currentVideo;
        
        // Показываем/скрываем кнопки в зависимости от состояния
        if (isPlaying) {
            this.playBtn.style.display = 'none';
            this.pauseBtn.style.display = 'inline-flex';
        } else {
            this.playBtn.style.display = 'inline-flex';
            this.pauseBtn.style.display = 'none';
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
     * Форматирует время
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
            const ctx = canvas.getContext('2d');
            
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
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ASCIIVideoPlayerApp();
});