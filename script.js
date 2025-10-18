class WebCrawler {
    constructor() {
        this.crawledUrls = new Set();
        this.urlsToCrawl = new Set();
        this.isCrawling = false;
        this.startTime = null;
        this.processedUrls = 0;
        this.maxPages = 200; // Увеличиваем лимит
    }

    async startCrawling() {
        const urlInput = document.getElementById('urlInput').value.trim();
        const errorDiv = document.getElementById('error');
        
        if (!urlInput) {
            this.showError('Пожалуйста, введите URL');
            return;
        }
        
        if (!this.isValidUrl(urlInput)) {
            this.showError('Пожалуйста, введите корректный URL');
            return;
        }

        // Сброс состояния
        errorDiv.textContent = '';
        this.crawledUrls.clear();
        this.urlsToCrawl.clear();
        this.isCrawling = true;
        this.startTime = Date.now();
        this.processedUrls = 0;
        
        this.showProgress();
        document.getElementById('crawlBtn').disabled = true;
        
        try {
            // Добавляем начальный URL
            const baseUrl = this.normalizeUrl(urlInput);
            this.urlsToCrawl.add(baseUrl);
            
            // Запускаем краулинг
            await this.crawlAllPages(baseUrl);
            
            this.showResult();
        } catch (error) {
            this.showError('Ошибка при краулинге: ' + error.message);
        } finally {
            this.isCrawling = false;
            document.getElementById('crawlBtn').disabled = false;
        }
    }

    async crawlAllPages(baseUrl) {
        while (this.urlsToCrawl.size > 0 && this.isCrawling && this.crawledUrls.size < this.maxPages) {
            const currentUrl = Array.from(this.urlsToCrawl)[0];
            this.urlsToCrawl.delete(currentUrl);
            
            if (!this.crawledUrls.has(currentUrl)) {
                await this.crawlSinglePage(currentUrl, baseUrl);
                this.processedUrls++;
                this.updateProgress();
                
                // Небольшая пауза между запросами
                await this.delay(200);
            }
        }
    }

    async crawlSinglePage(url, baseUrl) {
        if (this.crawledUrls.has(url)) return;
        
        this.crawledUrls.add(url);
        
        try {
            console.log('Crawling:', url);
            
            // Пробуем разные подходы для обхода CORS
            const html = await this.fetchWithFallback(url);
            
            if (html) {
                const newUrls = this.extractUrlsFromHtml(html, baseUrl);
                this.addNewUrlsToCrawl(newUrls, baseUrl);
            }
        } catch (error) {
            console.warn(`Не удалось обработать ${url}:`, error);
        }
    }

    async fetchWithFallback(url) {
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
            `https://corsproxy.io/?${encodeURIComponent(url)}`,
            `https://proxy.cors.sh/${url}`,
            url // Прямой запрос (может не сработать из-за CORS)
        ];

        for (const proxyUrl of proxies) {
            try {
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml',
                        'User-Agent': 'Mozilla/5.0 (compatible; WebCrawler/1.0)'
                    },
                    timeout: 10000
                });

                if (response.ok) {
                    return await response.text();
                }
            } catch (error) {
                console.log(`Proxy ${proxyUrl} failed:`, error);
                continue;
            }
        }
        
        throw new Error('All proxies failed');
    }

    extractUrlsFromHtml(html, baseUrl) {
        const urls = new Set();
        
        try {
            // Простой парсинг HTML с помощью регулярных выражений
            // Более надежный способ извлечения ссылок
            const linkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi;
            let match;
            
            while ((match = linkRegex.exec(html)) !== null) {
                const href = match[2];
                if (href) {
                    const absoluteUrl = this.getAbsoluteUrl(href, baseUrl);
                    if (this.isValidUrl(absoluteUrl)) {
                        urls.add(absoluteUrl);
                    }
                }
            }
            
            // Дополнительно ищем ссылки в других тегах
            const srcRegex = /<(?:link|img|script)\s+(?:[^>]*?\s+)?(?:href|src)=(["'])(.*?)\1/gi;
            while ((match = srcRegex.exec(html)) !== null) {
                const src = match[2];
                if (src) {
                    const absoluteUrl = this.getAbsoluteUrl(src, baseUrl);
                    if (this.isValidUrl(absoluteUrl)) {
                        urls.add(absoluteUrl);
                    }
                }
            }
            
        } catch (error) {
            console.error('Error parsing HTML:', error);
        }
        
        return Array.from(urls);
    }

    addNewUrlsToCrawl(newUrls, baseUrl) {
        newUrls.forEach(url => {
            const normalizedUrl = this.normalizeUrl(url);
            
            if (this.isSameDomain(normalizedUrl, baseUrl) &&
                this.isValidPageUrl(normalizedUrl) &&
                !this.crawledUrls.has(normalizedUrl) &&
                !this.urlsToCrawl.has(normalizedUrl) &&
                this.crawledUrls.size < this.maxPages) {
                
                this.urlsToCrawl.add(normalizedUrl);
            }
        });
    }

    getAbsoluteUrl(href, baseUrl) {
        try {
            // Убираем якоря и параметры запроса для нормализации
            const url = new URL(href, baseUrl);
            url.hash = ''; // Убираем якоря
            return url.href;
        } catch (error) {
            return href;
        }
    }

    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            urlObj.hash = '';
            // Приводим к нижнему регистру для единообразия
            return urlObj.href.toLowerCase();
        } catch (error) {
            return url;
        }
    }

    isSameDomain(url, baseUrl) {
        try {
            const urlObj = new URL(url);
            const baseUrlObj = new URL(baseUrl);
            return urlObj.hostname === baseUrlObj.hostname;
        } catch (error) {
            return false;
        }
    }

    isValidPageUrl(url) {
        try {
            const urlObj = new URL(url);
            
            // Исключаем файлы
            const excludedExtensions = [
                '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
                '.zip', '.rar', '.7z', '.tar', '.gz',
                '.exe', '.dmg', '.pkg',
                '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
                '.mp4', '.avi', '.mov', '.wmv',
                '.mp3', '.wav', '.ogg'
            ];
            
            const pathname = urlObj.pathname.toLowerCase();
            if (excludedExtensions.some(ext => pathname.endsWith(ext))) {
                return false;
            }
            
            // Исключаем почту, телефон и т.д.
            if (url.startsWith('mailto:') || 
                url.startsWith('tel:') || 
                url.startsWith('javascript:') ||
                url.startsWith('ftp:')) {
                return false;
            }
            
            // Включаем только HTTP/HTTPS
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
            
        } catch (error) {
            return false;
        }
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    showProgress() {
        const progressContainer = document.getElementById('progressContainer');
        progressContainer.style.display = 'block';
        document.getElementById('result').style.display = 'none';
        this.updateProgress();
    }

    updateProgress() {
        const progressFill = document.getElementById('progressFill');
        const progressInfo = document.getElementById('progressInfo');
        
        const progress = (this.processedUrls / Math.max(this.processedUrls + this.urlsToCrawl.size, 1)) * 100;
        progressFill.style.width = Math.min(progress, 100) + '%';
        
        const elapsedTime = (Date.now() - this.startTime) / 1000;
        const foundCount = this.crawledUrls.size;
        const remaining = this.urlsToCrawl.size;
        
        progressInfo.textContent = 
            `Найдено: ${foundCount} | В очереди: ${remaining} | Время: ${elapsedTime.toFixed(1)}с`;
    }

    showResult() {
        const resultDiv = document.getElementById('result');
        const urlCount = document.getElementById('urlCount');
        
        urlCount.textContent = this.crawledUrls.size;
        resultDiv.style.display = 'block';
        document.getElementById('progressContainer').style.display = 'none';
        
        // Показываем список URL в консоли для отладки
        console.log('Found URLs:', Array.from(this.crawledUrls));
    }

    showError(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    downloadCSV() {
        if (this.crawledUrls.size === 0) {
            this.showError('Нет данных для скачивания');
            return;
        }

        // Сортируем URL для удобства
        const sortedUrls = Array.from(this.crawledUrls).sort();
        const csvContent = ['URL', ...sortedUrls].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `crawled_pages_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Метод для остановки краулинга
    stopCrawling() {
        this.isCrawling = false;
        document.getElementById('crawlBtn').disabled = false;
        document.getElementById('progressContainer').style.display = 'none';
    }
}

const crawler = new WebCrawler();

function startCrawling() {
    crawler.startCrawling();
}

function downloadCSV() {
    crawler.downloadCSV();
}

// Добавляем кнопку остановки
document.addEventListener('DOMContentLoaded', function() {
    const crawlBtn = document.getElementById('crawlBtn');
    const originalText = crawlBtn.textContent;
    
    document.getElementById('urlInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            startCrawling();
        }
    });
});
