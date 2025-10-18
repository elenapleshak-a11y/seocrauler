class WebCrawler {
    constructor() {
        this.crawledUrls = new Set();
        this.isCrawling = false;
        this.startTime = null;
        this.totalUrls = 0;
        this.processedUrls = 0;
    }

    async startCrawling() {
        const urlInput = document.getElementById('urlInput').value.trim();
        const errorDiv = document.getElementById('error');
        
        // Валидация URL
        if (!urlInput) {
            this.showError('Пожалуйста, введите URL');
            return;
        }
        
        if (!this.isValidUrl(urlInput)) {
            this.showError('Пожалуйста, введите корректный URL (начинается с http:// или https://)');
            return;
        }

        // Сброс состояния
        errorDiv.textContent = '';
        this.crawledUrls.clear();
        this.isCrawling = true;
        this.startTime = Date.now();
        this.processedUrls = 0;
        
        // Показать прогресс
        this.showProgress();
        
        // Заблокировать кнопку
        document.getElementById('crawlBtn').disabled = true;
        
        try {
            // Начать краулинг с корневой страницы
            await this.crawlPage(urlInput, urlInput);
            
            // Показать результат
            this.showResult();
        } catch (error) {
            this.showError('Ошибка при краулинге: ' + error.message);
        } finally {
            this.isCrawling = false;
            document.getElementById('crawlBtn').disabled = false;
        }
    }

    async crawlPage(url, baseUrl) {
        // Проверяем, не посещали ли мы уже эту страницу
        if (this.crawledUrls.has(url)) {
            return;
        }

        // Добавляем URL в список обработанных
        this.crawledUrls.add(url);
        this.processedUrls++;
        this.updateProgress();

        try {
            // Используем CORS proxy для обхода ограничений браузера
            const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
            const response = await fetch(proxyUrl + url, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();
            
            // Парсим HTML и извлекаем ссылки
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = doc.querySelectorAll('a[href]');
            
            const foundUrls = [];
            
            for (const link of links) {
                const href = link.getAttribute('href');
                const absoluteUrl = this.getAbsoluteUrl(href, baseUrl);
                
                // Фильтруем только ссылки на том же домене
                if (this.isSameDomain(absoluteUrl, baseUrl) && 
                    this.isValidPageUrl(absoluteUrl)) {
                    foundUrls.push(absoluteUrl);
                }
            }
            
            // Убираем дубликаты
            const uniqueUrls = [...new Set(foundUrls)];
            this.totalUrls = uniqueUrls.length;
            
            // Рекурсивно обходим найденные ссылки (ограничиваем глубину для демонстрации)
            for (const foundUrl of uniqueUrls) {
                if (!this.isCrawling) break; // Останавливаемся если пользователь прервал
                
                if (!this.crawledUrls.has(foundUrl) && this.crawledUrls.size < 50) {
                    // Небольшая задержка чтобы не перегружать сервер
                    await this.delay(100);
                    await this.crawlPage(foundUrl, baseUrl);
                }
            }
            
        } catch (error) {
            console.warn(`Не удалось обработать страницу ${url}:`, error);
        }
    }

    getAbsoluteUrl(href, baseUrl) {
        try {
            return new URL(href, baseUrl).href;
        } catch (error) {
            return href;
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
        // Исключаем ссылки на файлы, якоря и т.д.
        const excludedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.zip', '.rar', '.exe'];
        return !excludedExtensions.some(ext => url.toLowerCase().includes(ext)) &&
               !url.includes('#') &&
               !url.includes('mailto:') &&
               !url.includes('tel:');
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
        
        const progress = this.processedUrls / Math.max(this.totalUrls, 1) * 100;
        progressFill.style.width = Math.min(progress, 100) + '%';
        
        const elapsedTime = (Date.now() - this.startTime) / 1000;
        progressInfo.textContent = `Обработано: ${this.processedUrls} страниц | Время: ${elapsedTime.toFixed(1)}с`;
    }

    showResult() {
        const resultDiv = document.getElementById('result');
        const urlCount = document.getElementById('urlCount');
        
        urlCount.textContent = this.crawledUrls.size;
        resultDiv.style.display = 'block';
        document.getElementById('progressContainer').style.display = 'none';
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

        const csvContent = Array.from(this.crawledUrls).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'crawled_pages.csv');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Создаем экземпляр краулера
const crawler = new WebCrawler();

// Глобальные функции для вызова из HTML
function startCrawling() {
    crawler.startCrawling();
}

function downloadCSV() {
    crawler.downloadCSV();
}

// Обработка ввода URL
document.getElementById('urlInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        startCrawling();
    }
});
