/**
 * ASCII Formatter - Форматирование ASCII кадров для разных социальных сетей
 */
class ASCIIFormatter {
    constructor() {
        this.platforms = {
            discord: {
                name: 'Discord',
                icon: '💬',
                format: (ascii) => `\`\`\`\n${ascii}\n\`\`\``,
                description: '```\nкадр\n```'
            },
            telegram: {
                name: 'Telegram',
                icon: '✈️',
                format: (ascii) => `\`${ascii}\``,
                description: '`кадр`'
            },
            twitter: {
                name: 'Twitter/X',
                icon: '🐦',
                format: (ascii) => `\`\`\`\n${ascii}\n\`\`\``,
                description: '```\nкадр\n```'
            },
            reddit: {
                name: 'Reddit',
                icon: '🔴',
                format: (ascii) => {
                    // Reddit использует 4 пробела для кода
                    const lines = ascii.split('\n');
                    return lines.map(line => `    ${line}`).join('\n');
                },
                description: '    кадр'
            },
            github: {
                name: 'GitHub',
                icon: '🐙',
                format: (ascii) => `\`\`\`\n${ascii}\n\`\`\``,
                description: '```\nкадр\n```'
            },
            plain: {
                name: 'Обычный текст',
                icon: '📄',
                format: (ascii) => ascii,
                description: 'кадр'
            }
        };
    }

    /**
     * Форматирует ASCII кадр для выбранной платформы
     * @param {string} asciiFrame - ASCII кадр
     * @param {string} platform - Название платформы
     * @returns {string} - Отформатированный кадр
     */
    formatForPlatform(asciiFrame, platform) {
        if (!this.platforms[platform]) {
            throw new Error(`Неподдерживаемая платформа: ${platform}`);
        }

        if (!asciiFrame || typeof asciiFrame !== 'string') {
            throw new Error('Некорректный ASCII кадр');
        }

        return this.platforms[platform].format(asciiFrame);
    }

    /**
     * Получает информацию о платформе
     * @param {string} platform - Название платформы
     * @returns {Object} - Информация о платформе
     */
    getPlatformInfo(platform) {
        if (!this.platforms[platform]) {
            throw new Error(`Неподдерживаемая платформа: ${platform}`);
        }

        return this.platforms[platform];
    }

    /**
     * Получает список всех поддерживаемых платформ
     * @returns {Array} - Массив платформ
     */
    getSupportedPlatforms() {
        return Object.keys(this.platforms);
    }

    /**
     * Создает превью форматированного кадра
     * @param {string} asciiFrame - ASCII кадр
     * @param {string} platform - Название платформы
     * @param {number} maxLines - Максимальное количество строк для превью
     * @returns {string} - Превью кадра
     */
    createPreview(asciiFrame, platform, maxLines = 10) {
        if (!asciiFrame) {
            return 'Нет кадра для предварительного просмотра';
        }

        try {
            const formatted = this.formatForPlatform(asciiFrame, platform);
            const lines = formatted.split('\n');
            
            if (lines.length <= maxLines) {
                return formatted;
            } else {
                const previewLines = lines.slice(0, maxLines);
                return previewLines.join('\n') + '\n... (показаны первые ' + maxLines + ' строк)';
            }
        } catch (error) {
            return `Ошибка форматирования: ${error.message}`;
        }
    }

    /**
     * Копирует текст в буфер обмена
     * @param {string} text - Текст для копирования
     * @returns {Promise<boolean>} - Успешность копирования
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                // Используем современный API
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback для старых браузеров
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            }
        } catch (error) {
            console.error('Ошибка копирования в буфер обмена:', error);
            return false;
        }
    }

    /**
     * Создает статистику кадра
     * @param {string} asciiFrame - ASCII кадр
     * @returns {Object} - Статистика кадра
     */
    getFrameStats(asciiFrame) {
        if (!asciiFrame) {
            return {
                lines: 0,
                characters: 0,
                nonWhitespace: 0,
                width: 0,
                height: 0
            };
        }

        const lines = asciiFrame.split('\n');
        const characters = asciiFrame.length;
        const nonWhitespace = asciiFrame.replace(/\s/g, '').length;
        const width = Math.max(...lines.map(line => line.length));
        const height = lines.length;

        return {
            lines,
            characters,
            nonWhitespace,
            width,
            height
        };
    }

    /**
     * Оптимизирует ASCII кадр для платформы
     * @param {string} asciiFrame - ASCII кадр
     * @param {string} platform - Название платформы
     * @param {Object} options - Опции оптимизации
     * @returns {string} - Оптимизированный кадр
     */
    optimizeForPlatform(asciiFrame, platform, options = {}) {
        const {
            maxWidth = 80,
            maxHeight = 40,
            trimEmptyLines = true
        } = options;

        let optimized = asciiFrame;

        // Обрезаем пустые строки
        if (trimEmptyLines) {
            const lines = optimized.split('\n');
            const trimmedLines = lines.filter(line => line.trim().length > 0);
            optimized = trimmedLines.join('\n');
        }

        // Ограничиваем размер для платформы
        const lines = optimized.split('\n');
        
        if (lines.length > maxHeight) {
            optimized = lines.slice(0, maxHeight).join('\n');
        }

        // Обрезаем слишком длинные строки
        const optimizedLines = lines.map(line => {
            if (line.length > maxWidth) {
                return line.substring(0, maxWidth);
            }
            return line;
        });

        optimized = optimizedLines.join('\n');

        return optimized;
    }
}

// Экспорт для использования в других модулях
window.ASCIIFormatter = ASCIIFormatter;
