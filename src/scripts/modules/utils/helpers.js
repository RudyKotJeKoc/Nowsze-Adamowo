/**
 * Utilities Module - Helper functions and DOM utilities
 */

export class UtilsManager {
    constructor() {
        this.toastContainer = null;
        this.toastId = 0;
        this.debounceTimers = new Map();
    }
    
    init() {
        this.setupToastContainer();
    }
    
    setupToastContainer() {
        this.toastContainer = document.getElementById('toast-container');
        if (!this.toastContainer) {
            this.toastContainer = document.createElement('div');
            this.toastContainer.id = 'toast-container';
            this.toastContainer.className = 'toast-container';
            this.toastContainer.setAttribute('role', 'region');
            this.toastContainer.setAttribute('aria-live', 'polite');
            this.toastContainer.setAttribute('aria-label', 'Notifications');
            document.body.appendChild(this.toastContainer);
        }
    }
    
    // DOM utilities
    $(selector) {
        return document.querySelector(selector);
    }
    
    $$(selector) {
        return document.querySelectorAll(selector);
    }
    
    createElement(tag, className = '', attributes = {}) {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        
        return element;
    }
    
    // Toast notifications
    showToast(message, type = 'info', duration = 3000) {
        if (!this.toastContainer) {
            this.setupToastContainer();
        }
        
        const toastId = ++this.toastId;
        const toast = this.createElement('div', `toast ${type}`, {
            'data-toast-id': toastId,
            'role': 'alert'
        });
        
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-message">${this.escapeHtml(message)}</span>
                <button class="toast-close" aria-label="Close notification">×</button>
            </div>
        `;
        
        // Add close functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.removeToast(toast));
        
        // Add to container
        this.toastContainer.appendChild(toast);
        
        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                this.removeToast(toast);
            }, duration);
        }
        
        return toastId;
    }
    
    removeToast(toast) {
        if (toast && toast.parentNode) {
            toast.classList.add('toast-removing');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }
    
    clearAllToasts() {
        if (this.toastContainer) {
            this.toastContainer.innerHTML = '';
        }
    }
    
    // String utilities
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    unescapeHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }
    
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
    
    slugify(text) {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }
    
    // Timing utilities
    debounce(func, wait, key = 'default') {
        const fullKey = `${func.name || 'anonymous'}_${key}`;
        
        if (this.debounceTimers.has(fullKey)) {
            clearTimeout(this.debounceTimers.get(fullKey));
        }
        
        const timeout = setTimeout(() => {
            this.debounceTimers.delete(fullKey);
            func();
        }, wait);
        
        this.debounceTimers.set(fullKey, timeout);
    }
    
    throttle(func, limit, key = 'default') {
        const fullKey = `throttle_${func.name || 'anonymous'}_${key}`;
        let inThrottle = false;
        
        return function() {
            const args = arguments;
            const context = this;
            
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Animation utilities
    fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        let start = null;
        
        function animate(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const opacity = Math.min(progress / duration, 1);
            
            element.style.opacity = opacity.toString();
            
            if (progress < duration) {
                requestAnimationFrame(animate);
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    fadeOut(element, duration = 300) {
        let start = null;
        const initialOpacity = parseFloat(getComputedStyle(element).opacity);
        
        function animate(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const opacity = Math.max(initialOpacity - (progress / duration), 0);
            
            element.style.opacity = opacity.toString();
            
            if (progress < duration) {
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    slideUp(element, duration = 300) {
        element.style.height = element.offsetHeight + 'px';
        element.style.overflow = 'hidden';
        element.style.transition = `height ${duration}ms ease`;
        
        requestAnimationFrame(() => {
            element.style.height = '0px';
        });
        
        setTimeout(() => {
            element.style.display = 'none';
            element.style.transition = '';
            element.style.height = '';
            element.style.overflow = '';
        }, duration);
    }
    
    slideDown(element, duration = 300) {
        element.style.display = 'block';
        const height = element.offsetHeight;
        element.style.height = '0px';
        element.style.overflow = 'hidden';
        element.style.transition = `height ${duration}ms ease`;
        
        requestAnimationFrame(() => {
            element.style.height = height + 'px';
        });
        
        setTimeout(() => {
            element.style.transition = '';
            element.style.height = '';
            element.style.overflow = '';
        }, duration);
    }
    
    // Validation utilities
    validateEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
    
    validateUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
    
    sanitizeInput(input) {
        return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                   .replace(/[<>]/g, '');
    }
    
    // Storage utilities
    setStorage(key, value, type = 'local') {
        try {
            const storage = type === 'session' ? sessionStorage : localStorage;
            storage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn('Storage not available:', error);
            return false;
        }
    }
    
    getStorage(key, defaultValue = null, type = 'local') {
        try {
            const storage = type === 'session' ? sessionStorage : localStorage;
            const item = storage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn('Storage retrieval failed:', error);
            return defaultValue;
        }
    }
    
    removeStorage(key, type = 'local') {
        try {
            const storage = type === 'session' ? sessionStorage : localStorage;
            storage.removeItem(key);
            return true;
        } catch (error) {
            console.warn('Storage removal failed:', error);
            return false;
        }
    }
    
    // URL utilities
    getUrlParams() {
        const params = {};
        const searchParams = new URLSearchParams(window.location.search);
        for (const [key, value] of searchParams) {
            params[key] = value;
        }
        return params;
    }
    
    updateUrlParam(key, value, replaceState = false) {
        const url = new URL(window.location);
        if (value === null || value === undefined || value === '') {
            url.searchParams.delete(key);
        } else {
            url.searchParams.set(key, value);
        }
        
        if (replaceState) {
            window.history.replaceState({}, '', url);
        } else {
            window.history.pushState({}, '', url);
        }
    }
    
    // Device detection
    isMobile() {
        return window.innerWidth <= 768;
    }
    
    isTablet() {
        return window.innerWidth > 768 && window.innerWidth <= 1024;
    }
    
    isDesktop() {
        return window.innerWidth > 1024;
    }
    
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    
    // Performance utilities
    measurePerformance(name, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        
        console.log(`${name} took ${end - start} milliseconds`);
        return result;
    }
    
    async measurePerformanceAsync(name, fn) {
        const start = performance.now();
        const result = await fn();
        const end = performance.now();
        
        console.log(`${name} took ${end - start} milliseconds`);
        return result;
    }
    
    // Network utilities
    async fetchWithTimeout(url, options = {}, timeout = 5000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    isOnline() {
        return navigator.onLine;
    }
    
    // Accessibility utilities
    focusElement(element) {
        if (element && typeof element.focus === 'function') {
            element.focus();
            
            // Scroll into view if needed
            if (element.scrollIntoView) {
                element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }
    
    trapFocus(container) {
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        const handleTabKey = (event) => {
            if (event.key !== 'Tab') return;
            
            if (event.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                    event.preventDefault();
                }
            } else {
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                    event.preventDefault();
                }
            }
        };
        
        container.addEventListener('keydown', handleTabKey);
        
        // Return cleanup function
        return () => {
            container.removeEventListener('keydown', handleTabKey);
        };
    }
    
    // Color utilities
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        }).join('');
    }
    
    // Format utilities
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }
    
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    // Cleanup
    cleanup() {
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        this.clearAllToasts();
    }
}

export default UtilsManager;