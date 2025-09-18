/**
 * Video Recorder - Запись ASCII видео в MP4
 */
class VideoRecorder {
    constructor() {
        this.isRecording = false;
        this.recordedFrames = [];
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.canvas = null;
        this.ctx = null;
        this.fps = 30;
        this.width = 800;
        this.height = 600;
        this.fontSize = 12;
        this.lineHeight = 14;
        this.audioStream = null;
        this.videoStream = null;
        this.combinedStream = null;
        this.recordingStartTime = 0;
        this.recordingDuration = 0;
        this.originalVideo = null;
    }

    /**
     * Инициализирует рекордер
     * @param {number} asciiWidth - Ширина ASCII в символах
     * @param {number} asciiHeight - Высота ASCII в символах
     * @param {number} fps - FPS записи
     */
    init(asciiWidth = 120, asciiHeight = 40, fps = 30) {
        this.fps = fps;
        
        // Вычисляем размеры видео на основе ASCII размеров
        const charWidth = 8;  // Ширина символа в пикселях
        const charHeight = 16; // Высота символа в пикселях
        
        this.width = asciiWidth * charWidth;
        this.height = asciiHeight * charHeight;
        
        // Создаем canvas для рендеринга ASCII в видео
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext('2d');
        
        // Настраиваем контекст для ASCII рендеринга
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `${charHeight}px 'JetBrains Mono', monospace`;
        this.ctx.textBaseline = 'top';
        
        // Сохраняем размеры символов
        this.charWidth = charWidth;
        this.charHeight = charHeight;
        
        console.log(`Размеры видео: ${this.width}x${this.height} (ASCII: ${asciiWidth}x${asciiHeight})`);
    }

    /**
     * Инициализирует аудио поток для записи
     * @param {HTMLVideoElement} videoElement - Видео элемент с аудио
     * @returns {Promise<void>}
     */
    async initAudioStream(videoElement) {
        try {
            // Сохраняем ссылку на оригинальное видео
            this.originalVideo = videoElement;
            
            // Проверяем, есть ли аудио в видео
            if (!videoElement.audioTracks || videoElement.audioTracks.length === 0) {
                console.warn('В видео нет аудио дорожки');
                this.audioStream = null;
                return;
            }

            // Создаем аудио контекст для захвата звука
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Создаем источник из видео элемента
            const source = audioContext.createMediaElementSource(videoElement);
            const destination = audioContext.createMediaStreamDestination();
            
            // Подключаем аудио к потоку
            source.connect(destination);
            source.connect(audioContext.destination);
            
            this.audioStream = destination.stream;
            this.audioContext = audioContext;
            console.log('Аудио поток инициализирован');
        } catch (error) {
            console.warn('Не удалось инициализировать аудио поток:', error);
            // Попробуем альтернативный метод
            await this.initAudioStreamAlternative(videoElement);
        }
    }

    /**
     * Альтернативный метод инициализации аудио потока
     * @param {HTMLVideoElement} videoElement - Видео элемент с аудио
     * @returns {Promise<void>}
     */
    async initAudioStreamAlternative(videoElement) {
        try {
            // Сохраняем ссылку на оригинальное видео
            this.originalVideo = videoElement;
            
            // Создаем скрытый аудио элемент для захвата звука
            const audioElement = videoElement.cloneNode();
            audioElement.muted = false;
            audioElement.volume = 1.0;
            
            // Создаем аудио контекст
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaElementSource(audioElement);
            const destination = audioContext.createMediaStreamDestination();
            
            // Подключаем аудио к потоку
            source.connect(destination);
            source.connect(audioContext.destination);
            
            this.audioStream = destination.stream;
            this.audioContext = audioContext;
            this.audioElement = audioElement;
            
            console.log('Аудио поток инициализирован (альтернативный метод)');
        } catch (error) {
            console.warn('Не удалось инициализировать аудио поток альтернативным методом:', error);
            this.audioStream = null;
        }
    }

    /**
     * Начинает запись
     */
    async startRecording() {
        if (this.isRecording) {
            return;
        }

        try {
            // Очищаем предыдущие данные
            this.recordedFrames = [];
            this.recordedChunks = [];
            
            // Записываем время начала записи
            this.recordingStartTime = Date.now();

            // Настраиваем MediaRecorder для записи canvas
            this.videoStream = this.canvas.captureStream(this.fps);
            
            // Создаем комбинированный поток с видео и аудио
            if (this.audioStream) {
                this.combinedStream = new MediaStream([
                    ...this.videoStream.getVideoTracks(),
                    ...this.audioStream.getAudioTracks()
                ]);
            } else {
                this.combinedStream = this.videoStream;
            }
            
            // Определяем лучший поддерживаемый формат
            let mimeType = 'video/webm;codecs=vp9';
            let videoBitsPerSecond = 2500000; // 2.5 Mbps
            let audioBitsPerSecond = 128000; // 128 kbps для аудио
            
            if (MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E"')) {
                mimeType = 'video/mp4; codecs="avc1.42E01E"';
                videoBitsPerSecond = 2000000; // 2 Mbps для MP4
                audioBitsPerSecond = 128000; // 128 kbps для аудио
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
                mimeType = 'video/webm;codecs=vp8';
                videoBitsPerSecond = 2000000; // 2 Mbps для VP8
                audioBitsPerSecond = 128000; // 128 kbps для аудио
            }

            const options = {
                mimeType: mimeType,
                videoBitsPerSecond: videoBitsPerSecond
            };

            // Добавляем аудио битрейт если есть аудио
            if (this.audioStream && this.audioStream.getAudioTracks().length > 0) {
                options.audioBitsPerSecond = audioBitsPerSecond;
            }

            this.mediaRecorder = new MediaRecorder(this.combinedStream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('Ошибка записи:', event.error);
            };

            this.mediaRecorder.start(100); // Записываем каждые 100ms
            this.isRecording = true;

            const audioInfo = this.audioStream ? ' с аудио' : ' без аудио';
            console.log(`Запись начата в формате: ${mimeType}${audioInfo}`);
        } catch (error) {
            console.error('Ошибка начала записи:', error);
            throw error;
        }
    }

    /**
     * Останавливает запись
     */
    stopRecording() {
        if (!this.isRecording) {
            return;
        }

        this.isRecording = false;
        
        // Вычисляем длительность записи
        this.recordingDuration = (Date.now() - this.recordingStartTime) / 1000;
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }

        console.log(`Запись остановлена. Длительность: ${this.recordingDuration.toFixed(2)} секунд`);
    }

    /**
     * Рендерит ASCII кадр на canvas
     * @param {string} asciiFrame - ASCII кадр
     * @param {number} asciiWidth - Ширина ASCII
     * @param {number} asciiHeight - Высота ASCII
     */
    renderFrame(asciiFrame, asciiWidth, asciiHeight) {
        if (!this.canvas || !this.ctx || !asciiFrame) {
            return;
        }

        // Очищаем canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Устанавливаем шрифт и цвет
        this.ctx.font = `${this.charHeight}px 'JetBrains Mono', monospace`;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textBaseline = 'top';

        // Разбиваем ASCII на строки
        const lines = asciiFrame.split('\n');
        
        // Рендерим каждую строку с точным позиционированием
        for (let y = 0; y < Math.min(lines.length, asciiHeight); y++) {
            const line = lines[y];
            if (!line) continue;
            
            const yPos = y * this.charHeight;
            
            // Рендерим каждый символ с точным позиционированием
            for (let x = 0; x < Math.min(line.length, asciiWidth); x++) {
                const char = line[x];
                const xPos = x * this.charWidth;
                this.ctx.fillText(char, xPos, yPos);
            }
        }
    }

    /**
     * Добавляет кадр в запись
     * @param {string} asciiFrame - ASCII кадр
     * @param {number} asciiWidth - Ширина ASCII
     * @param {number} asciiHeight - Высота ASCII
     * @param {number} currentTime - Текущее время видео
     */
    addFrame(asciiFrame, asciiWidth, asciiHeight, currentTime = 0) {
        if (!this.isRecording) {
            return;
        }

        // Вычисляем время относительно начала записи
        const recordingTime = (Date.now() - this.recordingStartTime) / 1000;
        
        // Синхронизируем аудио элемент с временем записи
        if (this.audioElement && this.audioElement.readyState >= 2) {
            try {
                // Устанавливаем время аудио относительно начала записи
                this.audioElement.currentTime = currentTime;
            } catch (error) {
                console.warn('Ошибка синхронизации аудио:', error);
            }
        }

        // Рендерим кадр на canvas
        this.renderFrame(asciiFrame, asciiWidth, asciiHeight);
        
        // Сохраняем кадр для последующего использования
        this.recordedFrames.push({
            ascii: asciiFrame,
            width: asciiWidth,
            height: asciiHeight,
            timestamp: Date.now(),
            currentTime: currentTime,
            recordingTime: recordingTime
        });
    }


    /**
     * Экспортирует записанное видео как MP4
     * @returns {Promise<Blob>} - MP4 файл
     */
    async exportMP4() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || this.recordedChunks.length === 0) {
                reject(new Error('Нет записанных данных'));
                return;
            }

            this.mediaRecorder.onstop = () => {
                try {
                    // Определяем тип на основе MIME типа MediaRecorder
                    const mimeType = this.mediaRecorder.mimeType;
                    let blobType = 'video/webm';
                    
                    if (mimeType.includes('mp4')) {
                        blobType = 'video/mp4';
                    } else if (mimeType.includes('webm')) {
                        blobType = 'video/webm';
                    }
                    
                    const blob = new Blob(this.recordedChunks, { type: blobType });
                    
                    // Если уже MP4, возвращаем как есть
                    if (blobType === 'video/mp4') {
                        resolve(blob);
                    } else {
                        // Конвертируем WebM в MP4 (если браузер поддерживает)
                        if (this.canConvertToMP4()) {
                            this.convertToMP4(blob).then(resolve).catch(reject);
                        } else {
                            // Возвращаем WebM если MP4 не поддерживается
                            resolve(blob);
                        }
                    }
                } catch (error) {
                    reject(new Error(`Ошибка создания видео: ${error.message}`));
                }
            };

            if (this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }
        });
    }

    /**
     * Создает видео с обрезанным аудио
     * @param {Blob} videoBlob - Оригинальное видео без аудио или с неправильным аудио
     * @returns {Promise<Blob>} - Видео с правильно обрезанным аудио
     */
    async createVideoWithTrimmedAudio(videoBlob) {
        if (!this.originalVideo || !this.recordingDuration) {
            return videoBlob;
        }

        try {
            // Создаем новый MediaRecorder с обрезанным аудио
            const videoStream = this.canvas.captureStream(this.fps);
            const trimmedAudioStream = await this.createTrimmedAudioStream();
            
            let combinedStream;
            if (trimmedAudioStream) {
                combinedStream = new MediaStream([
                    ...videoStream.getVideoTracks(),
                    ...trimmedAudioStream.getAudioTracks()
                ]);
            } else {
                combinedStream = videoStream;
            }

            // Определяем лучший поддерживаемый формат
            let mimeType = 'video/webm;codecs=vp9';
            if (MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E"')) {
                mimeType = 'video/mp4; codecs="avc1.42E01E"';
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
                mimeType = 'video/webm;codecs=vp8';
            }

            const options = {
                mimeType: mimeType,
                videoBitsPerSecond: 2000000
            };

            if (trimmedAudioStream && trimmedAudioStream.getAudioTracks().length > 0) {
                options.audioBitsPerSecond = 128000;
            }

            const mediaRecorder = new MediaRecorder(combinedStream, options);
            const chunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            return new Promise((resolve, reject) => {
                mediaRecorder.onstop = () => {
                    try {
                        const blobType = mimeType.includes('mp4') ? 'video/mp4' : 'video/webm';
                        const trimmedBlob = new Blob(chunks, { type: blobType });
                        resolve(trimmedBlob);
                    } catch (error) {
                        reject(error);
                    }
                };

                mediaRecorder.onerror = (error) => {
                    reject(error);
                };

                mediaRecorder.start(100);

                // Воспроизводим записанные кадры с правильным аудио
                this.playbackRecordedFramesWithAudio(mediaRecorder, resolve, reject);
            });

        } catch (error) {
            console.warn('Ошибка создания видео с обрезанным аудио:', error);
            return videoBlob;
        }
    }

    /**
     * Воспроизводит записанные кадры с синхронизированным аудио
     * @param {MediaRecorder} mediaRecorder - Рекордер для записи
     * @param {Function} resolve - Функция разрешения Promise
     * @param {Function} reject - Функция отклонения Promise
     */
    async playbackRecordedFramesWithAudio(mediaRecorder, resolve, reject) {
        try {
            if (this.recordedFrames.length === 0) {
                mediaRecorder.stop();
                return;
            }

            // Синхронизируем аудио с началом записи
            if (this.originalVideo && this.originalVideo.readyState >= 2) {
                this.originalVideo.currentTime = 0;
            }

            const frameInterval = 1000 / this.fps;
            let currentFrame = 0;

            const playNextFrame = () => {
                if (currentFrame >= this.recordedFrames.length) {
                    // Останавливаем аудио и запись
                    if (this.originalVideo) {
                        this.originalVideo.pause();
                    }
                    mediaRecorder.stop();
                    return;
                }

                const frame = this.recordedFrames[currentFrame];
                
                // Синхронизируем аудио с текущим кадром
                if (this.originalVideo && this.originalVideo.readyState >= 2) {
                    try {
                        this.originalVideo.currentTime = frame.currentTime;
                    } catch (error) {
                        console.warn('Ошибка синхронизации аудио:', error);
                    }
                }

                // Рендерим кадр
                this.renderFrame(frame.ascii, frame.width, frame.height);
                currentFrame++;

                setTimeout(playNextFrame, frameInterval);
            };

            playNextFrame();

        } catch (error) {
            reject(error);
        }
    }

    /**
     * Проверяет, может ли браузер конвертировать в MP4
     * @returns {boolean}
     */
    canConvertToMP4() {
        // Проверяем поддержку MP4 кодека
        const video = document.createElement('video');
        return video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
    }

    /**
     * Конвертирует WebM в MP4
     * @param {Blob} webmBlob - WebM файл
     * @returns {Promise<Blob>} - MP4 файл
     */
    async convertToMP4(webmBlob) {
        try {
            // Пытаемся использовать MediaRecorder с MP4 кодеком
            if (MediaRecorder.isTypeSupported('video/mp4')) {
                // Создаем новый MediaRecorder с MP4
                const stream = this.canvas.captureStream(this.fps);
                const mp4Recorder = new MediaRecorder(stream, {
                    mimeType: 'video/mp4',
                    videoBitsPerSecond: 2500000
                });

                return new Promise((resolve, reject) => {
                    const chunks = [];
                    mp4Recorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            chunks.push(event.data);
                        }
                    };

                    mp4Recorder.onstop = () => {
                        const mp4Blob = new Blob(chunks, { type: 'video/mp4' });
                        resolve(mp4Blob);
                    };

                    mp4Recorder.start();
                    
                    // Воспроизводим WebM видео для записи в MP4
                    const video = document.createElement('video');
                    video.src = URL.createObjectURL(webmBlob);
                    video.muted = true;
                    video.play();
                    
                    video.onended = () => {
                        mp4Recorder.stop();
                        URL.revokeObjectURL(video.src);
                    };
                });
            } else {
                // Если MP4 не поддерживается, возвращаем WebM
                console.warn('MP4 не поддерживается браузером, возвращаем WebM');
                return webmBlob;
            }
        } catch (error) {
            console.error('Ошибка конвертации в MP4:', error);
            return webmBlob;
        }
    }

    /**
     * Создает MP4 из предзаписанных кадров
     * @returns {Promise<Blob>} - MP4 файл
     */
    async createMP4FromFrames() {
        if (this.recordedFrames.length === 0) {
            throw new Error('Нет записанных кадров');
        }

        // Создаем новый MediaRecorder для записи всех кадров
        const stream = this.canvas.captureStream(this.fps);
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 2500000
        });

        const chunks = [];
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };

        return new Promise((resolve, reject) => {
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                resolve(blob);
            };

            mediaRecorder.start();

            // Воспроизводим все кадры
            const frameInterval = 1000 / this.fps;
            let currentFrame = 0;

            const playFrames = () => {
                if (currentFrame >= this.recordedFrames.length) {
                    mediaRecorder.stop();
                    return;
                }

                const frame = this.recordedFrames[currentFrame];
                this.renderFrame(frame.ascii, frame.width, frame.height);
                currentFrame++;

                setTimeout(playFrames, frameInterval);
            };

            playFrames();
        });
    }

    /**
     * Скачивает видео файл
     * @param {Blob} videoBlob - Видео файл
     * @param {string} filename - Имя файла
     */
    downloadVideo(videoBlob, filename = 'ascii_video.mp4') {
        try {
            // Определяем правильное расширение на основе типа файла
            let extension = 'mp4';
            if (videoBlob.type.includes('webm')) {
                extension = 'webm';
            } else if (videoBlob.type.includes('mp4')) {
                extension = 'mp4';
            }
            
            // Обновляем имя файла с правильным расширением
            if (!filename.endsWith(extension)) {
                filename = filename.replace(/\.[^.]+$/, `.${extension}`);
            }
            
            const url = URL.createObjectURL(videoBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log(`Видео сохранено: ${filename} (${(videoBlob.size / 1024 / 1024).toFixed(2)} MB)`);
        } catch (error) {
            console.error('Ошибка скачивания видео:', error);
            throw error;
        }
    }

    /**
     * Очищает данные записи
     */
    cleanup() {
        this.isRecording = false;
        this.recordedFrames = [];
        this.recordedChunks = [];
        this.recordingStartTime = 0;
        this.recordingDuration = 0;
        this.originalVideo = null;
        
        if (this.mediaRecorder) {
            this.mediaRecorder = null;
        }
        
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
        
        if (this.combinedStream) {
            this.combinedStream.getTracks().forEach(track => track.stop());
            this.combinedStream = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement = null;
        }
    }
}

// Экспорт для использования в других модулях
window.VideoRecorder = VideoRecorder;
