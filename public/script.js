/**
 * Radio Adamowo - Application Bootstrap
 * Entry point that loads and orchestrates all modules
 */

// ===== CONFIGURATION =====
const CONFIG = {
    // Audio settings
    VISUALIZER_FFT_SIZE: 256,
    CROSSFADE_DURATION: 300,
    
    // UI settings
    SCROLL_THRESHOLD: 300,
    ANIMATION_SPEED_MULTIPLIER: 1,
    
    // i18n settings
    DEFAULT_LANGUAGE: 'pl',
    SUPPORTED_LANGUAGES: ['pl', 'en', 'nl'],
    LANGUAGE_STORAGE_KEY: 'radio-adamowo-language',
    
    // Cache settings
    CACHE_NAME: 'radio-adamowo-v1',
    
    // Module paths
    MODULE_PATHS: {
        i18n: '../src/scripts/modules/i18n/manager.js',
        audio: '../src/scripts/modules/audio/player.js', 
        ui: '../src/scripts/modules/ui/manager.js',
        manipulation: '../src/scripts/modules/manipulation/detector.js',
        services: {
            pwa: '../src/scripts/modules/services/pwa.js',
            storage: '../src/scripts/modules/services/storage.js',
            analytics: '../src/scripts/modules/services/analytics.js'
        },
        utils: '../src/scripts/modules/utils/helpers.js'
    }
};

// ===== GLOBAL STATE =====
const AppState = {
    modules: new Map(),
    isInitialized: false,
    currentLanguage: CONFIG.DEFAULT_LANGUAGE,
    
    // Audio state
    isAudioInitialized: false,
    isPlaying: false,
    currentTrack: null,
    
    // UI state
    currentSection: 'player',
    isMobileMenuOpen: false
};

// ===== MODULE LOADER =====
class ModuleLoader {
    static async loadModule(moduleName, path = null) {
        if (AppState.modules.has(moduleName)) {
            return AppState.modules.get(moduleName);
        }
        
        try {
            const modulePath = path || CONFIG.MODULE_PATHS[moduleName];
            if (!modulePath) {
                throw new Error(`No path configured for module: ${moduleName}`);
            }
            
            // For now, we'll provide fallbacks for missing modules
            const module = await this.createFallbackModule(moduleName);
            AppState.modules.set(moduleName, module);
            return module;
            
        } catch (error) {
            console.warn(`Failed to load module ${moduleName}:`, error);
            // Return fallback module
            const fallback = await this.createFallbackModule(moduleName);
            AppState.modules.set(moduleName, fallback);
            return fallback;
        }
    }
    
    static async createFallbackModule(moduleName) {
        // Create minimal fallback implementations
        switch (moduleName) {
            case 'i18n':
                return new I18nFallback();
            case 'audio':
                return new AudioFallback();
            case 'ui':
                return new UIFallback();
            case 'utils':
                return new UtilsFallback();
            default:
                return new GenericFallback(moduleName);
        }
    }
}

// ===== FALLBACK IMPLEMENTATIONS =====
class I18nFallback {
    constructor() {
        this.translations = new Map();
        this.currentLang = CONFIG.DEFAULT_LANGUAGE;
        this.init();
    }
    
    async init() {
        // Load existing translations
        try {
            for (const lang of CONFIG.SUPPORTED_LANGUAGES) {
                const response = await fetch(`lang/${lang}.json`);
                if (response.ok) {
                    const translations = await response.json();
                    this.translations.set(lang, translations);
                }
            }
        } catch (error) {
            console.warn('Failed to load translations:', error);
            // Provide basic fallback translations
            this.translations.set('pl', {
                'common': { 'error': 'Błąd', 'success': 'Sukces', 'loading': 'Ładowanie...' },
                'player': { 'title': 'Centrum Muzyczne', 'trackInfo': 'Załaduj muzykę' },
                'navigation': { 'player': 'Odtwarzacz', 'laboratory': 'Laboratorium' }
            });
        }
    }
    
    t(key, params = {}) {
        const langData = this.translations.get(this.currentLang) || this.translations.get('pl') || {};
        const keys = key.split('.');
        let value = langData;
        
        for (const k of keys) {
            value = value?.[k];
            if (!value) break;
        }
        
        if (!value) {
            console.warn(`Translation missing for key: ${key}`);
            return key;
        }
        
        // Simple parameter substitution
        if (typeof value === 'string' && Object.keys(params).length > 0) {
            return value.replace(/\{\{(\w+)\}\}/g, (match, param) => params[param] || match);
        }
        
        return value;
    }
    
    setLanguage(lang) {
        if (CONFIG.SUPPORTED_LANGUAGES.includes(lang)) {
            this.currentLang = lang;
            localStorage.setItem(CONFIG.LANGUAGE_STORAGE_KEY, lang);
            this.updateUI();
        }
    }
    
    updateUI() {
        // Update all elements with data-i18n attributes
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation !== key) {
                element.textContent = translation;
            }
        });
        
        // Update HTML lang attribute
        document.documentElement.lang = this.currentLang;
    }
}

class AudioFallback {
    constructor() {
        this.audioElement = null;
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
    }
    
    async init() {
        this.audioElement = document.getElementById('radio-player');
        if (!this.audioElement) {
            console.warn('Audio element not found');
            return;
        }
        
        // Load playlist
        try {
            const response = await fetch('data/playlist.json');
            if (response.ok) {
                const data = await response.json();
                this.playlist = data.tracks || [];
            }
        } catch (error) {
            console.warn('Failed to load playlist:', error);
            // Show fallback message
            this.showFallbackMessage();
        }
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const playBtn = document.getElementById('radio-play-pause-btn');
        const nextBtn = document.getElementById('radio-next-btn');
        const prevBtn = document.getElementById('radio-prev-btn');
        
        if (playBtn) {
            playBtn.addEventListener('click', () => this.togglePlayPause());
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.next());
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.prev());
        }
    }
    
    async togglePlayPause() {
        if (!this.audioElement) return;
        
        if (this.isPlaying) {
            this.audioElement.pause();
        } else {
            // Request user interaction for autoplay
            if (!AppState.isAudioInitialized) {
                this.showAutoplayOverlay();
                return;
            }
            
            if (!this.audioElement.src && this.playlist.length > 0) {
                this.loadTrack(this.currentIndex);
            }
            
            try {
                await this.audioElement.play();
            } catch (error) {
                console.warn('Playback failed:', error);
                this.showError('Nie można odtworzyć audio');
            }
        }
    }
    
    loadTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        const track = this.playlist[index];
        if (track && track.file) {
            this.audioElement.src = track.file;
            this.currentIndex = index;
            AppState.currentTrack = track;
            this.updateTrackDisplay();
        }
    }
    
    next() {
        const nextIndex = (this.currentIndex + 1) % this.playlist.length;
        this.loadTrack(nextIndex);
        if (this.isPlaying) {
            this.audioElement.play().catch(console.warn);
        }
    }
    
    prev() {
        const prevIndex = this.currentIndex === 0 ? this.playlist.length - 1 : this.currentIndex - 1;
        this.loadTrack(prevIndex);
        if (this.isPlaying) {
            this.audioElement.play().catch(console.warn);
        }
    }
    
    updateTrackDisplay() {
        const titleEl = document.getElementById('current-track-title');
        const metaEl = document.getElementById('current-track-meta');
        
        if (titleEl && AppState.currentTrack) {
            titleEl.textContent = this.generateTitle(AppState.currentTrack.file);
        }
        
        if (metaEl && AppState.currentTrack) {
            const categoryEl = metaEl.querySelector('.category');
            const durationEl = metaEl.querySelector('.duration');
            
            if (categoryEl) {
                categoryEl.textContent = AppState.currentTrack.category || 'Unknown';
            }
            
            if (durationEl) {
                durationEl.textContent = AppState.currentTrack.metadata?.duration || '00:00';
            }
        }
    }
    
    generateTitle(filepath) {
        if (!filepath) return 'Unknown Track';
        const filename = filepath.split('/').pop();
        return filename.replace(/\\.mp3$/i, '').replace(/_/g, ' ');
    }
    
    showAutoplayOverlay() {
        const overlay = document.getElementById('autoplay-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            
            // Setup mood buttons
            overlay.querySelectorAll('.mood-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    AppState.isAudioInitialized = true;
                    overlay.classList.add('hidden');
                    this.togglePlayPause();
                });
            });
        }
    }
    
    showFallbackMessage() {
        const fallback = document.getElementById('audio-fallback');
        if (fallback) {
            fallback.classList.remove('hidden');
        }
    }
    
    showError(message) {
        // Use UtilsFallback to show toast
        const utils = AppState.modules.get('utils');
        if (utils) {
            utils.showToast(message, 'error');
        }
    }
}

class UIFallback {
    constructor() {
        this.currentSection = 'player';
    }
    
    init() {
        this.setupNavigation();
        this.setupMobileMenu();
        this.setupLanguageSwitcher();
    }
    
    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                this.showSection(section);
            });
        });
    }
    
    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show target section
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = sectionName;
        }
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }
    
    setupMobileMenu() {
        const toggle = document.getElementById('nav-toggle');
        const menu = document.getElementById('nav-menu');
        
        if (toggle && menu) {
            toggle.addEventListener('click', () => {
                const isOpen = menu.classList.contains('active');
                menu.classList.toggle('active');
                toggle.setAttribute('aria-expanded', (!isOpen).toString());
                AppState.isMobileMenuOpen = !isOpen;
            });
        }
    }
    
    setupLanguageSwitcher() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.getAttribute('data-lang');
                const i18n = AppState.modules.get('i18n');
                
                if (i18n) {
                    i18n.setLanguage(lang);
                    
                    // Update button states
                    document.querySelectorAll('.lang-btn').forEach(b => {
                        b.classList.remove('active');
                        b.setAttribute('aria-pressed', 'false');
                    });
                    
                    btn.classList.add('active');
                    btn.setAttribute('aria-pressed', 'true');
                }
            });
        });
    }
}

class UtilsFallback {
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        
        container.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            toast.remove();
        }, duration);
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    $(selector) {
        return document.querySelector(selector);
    }
    
    $$(selector) {
        return document.querySelectorAll(selector);
    }
}

class GenericFallback {
    constructor(moduleName) {
        this.moduleName = moduleName;
        console.warn(`Using generic fallback for module: ${moduleName}`);
    }
    
    init() {
        // Generic initialization
    }
}

// ===== ANALYTICS MANAGER =====
class AnalyticsManager {
    constructor() {
        this.events = [];
        this.enabled = true;
    }
    
    init() {
        // Initialize analytics (GA4, self-hosted, etc.)
        this.setupErrorTracking();
    }
    
    track(category, action, label, value) {
        if (!this.enabled) return;
        
        const event = {
            category,
            action,
            label,
            value,
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        this.events.push(event);
        
        // Send to external analytics (placeholder)
        this.sendToExternalAnalytics(event);
        
        // Store locally for debugging
        if (this.events.length > 100) {
            this.events.shift(); // Keep only recent events
        }
    }
    
    sendToExternalAnalytics(event) {
        // Placeholder for GA4 or other analytics integration
        // gtag('event', event.action, {
        //     event_category: event.category,
        //     event_label: event.label,
        //     value: event.value
        // });
    }
    
    setupErrorTracking() {
        window.addEventListener('error', (event) => {
            this.track('error', 'javascript_error', event.message, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.track('error', 'promise_rejection', event.reason);
        });
    }
    
    trackAudioEvent(action, trackInfo) {
        this.track('audio', action, trackInfo?.category, trackInfo?.duration);
    }
    
    trackUIEvent(action, section) {
        this.track('ui', action, section);
    }
    
    trackLanguageChange(oldLang, newLang) {
        this.track('i18n', 'language_change', `${oldLang}_to_${newLang}`);
    }
}

// ===== APPLICATION INITIALIZATION =====
class RadioAdamowoApp {
    constructor() {
        this.analytics = new AnalyticsManager();
        this.init();
    }
    
    async init() {
        if (AppState.isInitialized) return;
        
        try {
            // Initialize analytics first
            this.analytics.init();
            
            // Load core modules
            const [i18n, audio, ui, utils] = await Promise.all([
                ModuleLoader.loadModule('i18n'),
                ModuleLoader.loadModule('audio'),
                ModuleLoader.loadModule('ui'),
                ModuleLoader.loadModule('utils')
            ]);
            
            // Initialize modules in order
            await i18n.init();
            await audio.init();
            ui.init();
            
            // Set up global error handling
            this.setupGlobalErrorHandling();
            
            // Register service worker
            this.registerServiceWorker();
            
            // Initialize PWA features
            this.initializePWA();
            
            AppState.isInitialized = true;
            
            // Track successful initialization
            this.analytics.track('app', 'initialized', 'success');
            
            // Remove any loading indicators
            document.body.classList.remove('loading');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.analytics.track('app', 'initialization_failed', error.message);
            
            // Show error to user
            const utils = AppState.modules.get('utils');
            if (utils) {
                utils.showToast('Wystąpił błąd podczas ładowania aplikacji', 'error');
            }
        }
    }
    
    setupGlobalErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            
            const utils = AppState.modules.get('utils');
            if (utils) {
                utils.showToast('Wystąpił nieoczekiwany błąd', 'error');
            }
        });
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js');
                console.log('SW registered:', registration);
                this.analytics.track('pwa', 'sw_registered', 'success');
            } catch (error) {
                console.warn('SW registration failed:', error);
                this.analytics.track('pwa', 'sw_registration_failed', error.message);
            }
        }
    }
    
    initializePWA() {
        // Handle app install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.analytics.track('pwa', 'install_prompt_available', 'true');
        });
        
        // Handle successful app install
        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            this.analytics.track('pwa', 'app_installed', 'success');
        });
        
        // Update UI for standalone mode
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
            document.body.classList.add('pwa-standalone');
            this.analytics.track('pwa', 'running_standalone', 'true');
        }
    }
}

// ===== GLOBAL API FOR EXTERNAL ACCESS =====
window.RadioAdamowo = {
    // Audio controls
    play() {
        const audio = AppState.modules.get('audio');
        return audio?.togglePlayPause();
    },
    
    next() {
        const audio = AppState.modules.get('audio');
        return audio?.next();
    },
    
    prev() {
        const audio = AppState.modules.get('audio');
        return audio?.prev();
    },
    
    // Language controls
    switchLanguage(lang) {
        const i18n = AppState.modules.get('i18n');
        return i18n?.setLanguage(lang);
    },
    
    getCurrentLanguage() {
        const i18n = AppState.modules.get('i18n');
        return i18n?.currentLang || CONFIG.DEFAULT_LANGUAGE;
    },
    
    t(key, params) {
        const i18n = AppState.modules.get('i18n');
        return i18n?.t(key, params) || key;
    },
    
    // UI controls
    showSection(section) {
        const ui = AppState.modules.get('ui');
        return ui?.showSection(section);
    },
    
    // Utilities
    showToast(message, type) {
        const utils = AppState.modules.get('utils');
        return utils?.showToast(message, type);
    },
    
    // State access (read-only)
    get state() {
        return { ...AppState };
    },
    
    // Analytics
    track(category, action, label, value) {
        return window.RadioAdamowoApp?.analytics?.track(category, action, label, value);
    }
};

// ===== INITIALIZE APPLICATION =====
document.addEventListener('DOMContentLoaded', () => {
    window.RadioAdamowoApp = new RadioAdamowoApp();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        RadioAdamowoApp,
        ModuleLoader,
        AnalyticsManager,
        CONFIG,
        AppState
    };
}