// ===== CONFIGURATION =====
const CONFIG = {
    // Stream configuration - set to empty string to hide live functionality
    STREAM_URL: '', // 'https://example.com/radio-adamowo/stream.m3u8'
    FALLBACK_URL: '',
    
    // Cache configuration
    CACHE_NAME: 'radio-adamowo-v2',
    
    // Audio settings
    VISUALIZER_FFT_SIZE: 256,
    CROSSFADE_DURATION: 300,
    
    // UI settings
    SCROLL_THRESHOLD: 300,
    ANIMATION_SPEED_MULTIPLIER: 1,
    
    // Keyboard shortcuts
    SHORTCUTS: {
        PLAY_PAUSE: ' ', // Space
        NEXT: 'ArrowRight',
        PREV: 'ArrowLeft',
        MUTE: 'm',
        SHUFFLE: 's',
        HOME: 'Home'
    },
    
    // i18n settings
    DEFAULT_LANGUAGE: 'pl',
    SUPPORTED_LANGUAGES: ['pl', 'en', 'nl'],
    LANGUAGE_STORAGE_KEY: 'radio-adamowo-language'
};

// ===== GLOBAL STATE =====
const AppState = {
    // Audio
    audioContext: null,
    audioSource: null,
    analyser: null,
    gainNode: null,
    isAudioInitialized: false,
    isPlaying: false,
    isMuted: false,
    currentVolume: 1,
    
    // Playlist
    playlists: {
        ambient: [],
        disco: [],
        hiphop: [],
        barbara: [],
        kids: [],
        full: [],
        podcasts: []
    },
    currentPlaylist: [],
    currentTrackIndex: 0,
    isShuffled: false,
    
    // UI
    animationId: null,
    isModalOpen: false,
    
    // PWA
    deferredPrompt: null,
    
    // HLS
    hls: null,
    isLiveMode: false,
    
    // i18n
    currentLanguage: CONFIG.DEFAULT_LANGUAGE,
    translations: {},
    isLanguageLoaded: false
};

// ===== INTERNATIONALIZATION MANAGER =====
const I18nManager = {
    async init() {
        // Detect user language
        const savedLanguage = localStorage.getItem(CONFIG.LANGUAGE_STORAGE_KEY);
        const browserLanguage = navigator.language.split('-')[0];
        
        let targetLanguage = CONFIG.DEFAULT_LANGUAGE;
        
        if (savedLanguage && CONFIG.SUPPORTED_LANGUAGES.includes(savedLanguage)) {
            targetLanguage = savedLanguage;
        } else if (CONFIG.SUPPORTED_LANGUAGES.includes(browserLanguage)) {
            targetLanguage = browserLanguage;
        }
        
        await this.loadLanguage(targetLanguage);
        this.setupLanguageSelector();
    },
    
    async loadLanguage(langCode) {
        if (!CONFIG.SUPPORTED_LANGUAGES.includes(langCode)) {
            langCode = CONFIG.DEFAULT_LANGUAGE;
        }
        
        try {
            const response = await fetch(`lang/${langCode}.json`);
            if (!response.ok) throw new Error(`Failed to load ${langCode}`);
            
            AppState.translations = await response.json();
            AppState.currentLanguage = langCode;
            AppState.isLanguageLoaded = true;
            
            // Save language preference
            localStorage.setItem(CONFIG.LANGUAGE_STORAGE_KEY, langCode);
            
            // Update UI
            this.updateUI();
            this.updateActiveLanguageSelector();
            
            console.log(`Language loaded: ${langCode}`);
            
        } catch (error) {
            console.error('Failed to load language:', error);
            if (langCode !== CONFIG.DEFAULT_LANGUAGE) {
                // Fallback to default language
                await this.loadLanguage(CONFIG.DEFAULT_LANGUAGE);
            }
        }
    },
    
    setupLanguageSelector() {
        // Create language selector if it doesn't exist
        let selector = Utils.$('#language-selector');
        if (!selector) {
            selector = this.createLanguageSelector();
        }
        
        // Add event listeners
        Utils.$$('.lang-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const langCode = btn.dataset.lang;
                this.switchLanguage(langCode);
            });
        });
    },
    
    createLanguageSelector() {
        const nav = Utils.$('.nav-container');
        if (!nav) return null;
        
        const selectorHTML = `
            <div id="language-selector" class="language-selector">
                <button class="lang-btn ${AppState.currentLanguage === 'pl' ? 'active' : ''}" data-lang="pl" aria-label="Polski">
                    🇵🇱 PL
                </button>
                <button class="lang-btn ${AppState.currentLanguage === 'en' ? 'active' : ''}" data-lang="en" aria-label="English">
                    🇺🇸 EN
                </button>
                <button class="lang-btn ${AppState.currentLanguage === 'nl' ? 'active' : ''}" data-lang="nl" aria-label="Nederlands">
                    🇳🇱 NL
                </button>
            </div>
        `;
        
        nav.insertAdjacentHTML('beforeend', selectorHTML);
        return Utils.$('#language-selector');
    },
    
    async switchLanguage(langCode) {
        if (langCode === AppState.currentLanguage) return;
        
        // Show loading state
        Utils.$$('.lang-btn').forEach(btn => {
            btn.disabled = true;
            if (btn.dataset.lang === langCode) {
                btn.innerHTML = '⏳';
            }
        });
        
        await this.loadLanguage(langCode);
        
        // Re-enable buttons
        Utils.$$('.lang-btn').forEach(btn => {
            btn.disabled = false;
        });
        
        Utils.showToast(this.t('common.success') + ': ' + langCode.toUpperCase(), 'success');
    },
    
    updateActiveLanguageSelector() {
        Utils.$$('.lang-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.lang === AppState.currentLanguage) {
                btn.classList.add('active');
                btn.innerHTML = `${this.getFlagEmoji(AppState.currentLanguage)} ${AppState.currentLanguage.toUpperCase()}`;
            } else {
                btn.innerHTML = `${this.getFlagEmoji(btn.dataset.lang)} ${btn.dataset.lang.toUpperCase()}`;
            }
        });
    },
    
    getFlagEmoji(langCode) {
        const flags = {
            'pl': '🇵🇱',
            'en': '🇺🇸',
            'nl': '🇳🇱'
        };
        return flags[langCode] || '🏳️';
    },
    
    updateUI() {
        if (!AppState.isLanguageLoaded) return;
        
        // Update document title and meta
        document.title = this.t('meta.title');
        const metaDesc = Utils.$('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', this.t('meta.description'));
        }
        
        // Update all translatable elements
        this.updateElement('.hero-title', 'header.title');
        this.updateElement('.hero-subtitle', 'header.subtitle');
        this.updateElement('.on-air-indicator', 'header.onAir');
        this.updateElement('.studio-label', 'header.studio');
        
        // Navigation
        this.updateElement('[href="#manipulation-lab"]', 'navigation.laboratory');
        this.updateElement('[href="#radio-player-section"]', 'navigation.player');
        this.updateElement('[href="#resistance-training"]', 'navigation.resistance');
        this.updateElement('[href="#psychological-games"]', 'navigation.games');
        this.updateElement('[href="#manipulation-museum"]', 'navigation.museum');
        this.updateElement('[href="#achievement-system"]', 'navigation.achievements');
        
        // Autoplay overlay
        this.updateElement('.autoplay-title', 'autoplay.title');
        this.updateElement('.autoplay-description', 'autoplay.description');
        this.updateElement('.choice-question', 'autoplay.choiceQuestion');
        this.updateElement('#start-btn-easy', 'autoplay.easy');
        this.updateElement('#start-btn-normal', 'autoplay.normal');
        this.updateElement('#start-btn-hard', 'autoplay.hard');
        this.updateElement('.choice-hint small', 'autoplay.hint');
        
        // Section titles
        this.updateElement('.intro-section h2', 'intro.title');
        this.updateElement('.intro-text', 'intro.description');
        this.updateElement('#manipulation-lab .section-title', 'laboratory.title');
        this.updateElement('.lab-intro', 'laboratory.intro');
        this.updateElement('#resistance-training .section-title', 'resistance.title');
        this.updateElement('#psychological-games .section-title', 'games.title');
        this.updateElement('#achievement-system .section-title', 'achievements.title');
        this.updateElement('#radio-player-section .section-title', 'radio.title');
        this.updateElement('#manipulation-museum .section-title', 'museum.title');
        this.updateElement('#interactive-title', 'chat.title');
        this.updateElement('#studio-title', 'studio.title');
        this.updateElement('#violence-title', 'violenceLoop.title');
        this.updateElement('#guide-title', 'guide.title');
        this.updateElement('.final-title', 'final.title');
        
        // Update dynamic content
        this.updateScenarios();
        this.updateResistanceTraining();
        this.updateGames();
        this.updateAchievements();
        this.updateRadioPlayer();
        this.updateMuseum();
        this.updateChat();
        this.updateStudio();
        this.updateViolenceLoop();
        this.updateGuide();
        this.updateFinal();
        this.updateFooter();
        this.updateModals();
        this.updateFAB();
        
        // Update other UI elements
        this.updateMiscElements();
        
        // Regenerate sins guide with new language
        if (window.SinsGuide && typeof SinsGuide.init === 'function') {
            SinsGuide.init();
        }
    },
    
    updateElement(selector, translationKey, attribute = 'textContent', placeholder = null) {
        const element = Utils.$(selector);
        if (element && this.t(translationKey)) {
            if (attribute === 'placeholder') {
                element.placeholder = this.t(translationKey);
            } else if (attribute === 'textContent') {
                element.textContent = this.t(translationKey);
            } else {
                element.setAttribute(attribute, this.t(translationKey));
            }
        }
    },
    
    updateScenarios() {
        // Update laboratory scenarios
        const scenarios = ['gaslighting', 'emotionalBlackmail', 'loveBombing', 'triangulation'];
        scenarios.forEach(scenario => {
            this.updateElement(`[data-scenario="${scenario}"] .scenario-title`, `laboratory.scenarios.${scenario}.title`);
            this.updateElement(`[data-scenario="${scenario}"] .scenario-description`, `laboratory.scenarios.${scenario}.description`);
            this.updateElement(`[data-scenario="${scenario}"] .message.manipulator`, `laboratory.scenarios.${scenario}.preview`);
            this.updateElement(`[data-scenario="${scenario}"] .scenario-start-btn`, 'laboratory.startButton');
        });
    },
    
    updateResistanceTraining() {
        this.updateElement('.meter-title', 'resistance.meterTitle');
        this.updateElement('.resistance-level', `resistance.levels.${this.getCurrentResistanceLevel()}`);
        
        // Update module cards
        const modules = ['basics', 'advanced', 'master'];
        modules.forEach(module => {
            this.updateElement(`[data-module="${module}"] .module-title`, `resistance.modules.${module}.title`);
            this.updateElement(`[data-module="${module}"] .module-description`, `resistance.modules.${module}.description`);
        });
    },
    
    updateGames() {
        this.updateElement('[data-game="detector"] .game-title', 'games.detector.title');
        this.updateElement('[data-game="detector"] .game-description', 'games.detector.description');
        this.updateElement('[data-game="simulator"] .game-title', 'games.simulator.title');
        this.updateElement('[data-game="simulator"] .game-description', 'games.simulator.description');
        
        Utils.$$('.game-play-btn').forEach(btn => {
            btn.textContent = this.t('games.playButton');
        });
    },
    
    updateAchievements() {
        const achievements = ['firstDetection', 'manipulationMaster', 'resistanceHero', 'easterEgg'];
        achievements.forEach(achievement => {
            this.updateElement(`[data-achievement="${achievement}"] .achievement-title`, `achievements.${achievement}.title`);
            this.updateElement(`[data-achievement="${achievement}"] .achievement-description`, `achievements.${achievement}.description`);
        });
    },
    
    updateRadioPlayer() {
        this.updateElement('.mood-title', 'radio.moodTitle');
        this.updateElement('.mood-hint', 'radio.moodHint');
        this.updateElement('.live-text', 'radio.liveToggle');
        this.updateElement('#current-track', 'radio.trackInfo');
        
        // Update mood buttons
        const moods = ['confused', 'angry', 'sad', 'hopeful'];
        moods.forEach(mood => {
            this.updateElement(`[data-mood="${mood}"]`, `radio.moods.${mood}`);
        });
        
        // Update playlist buttons
        const playlists = ['ambient', 'disco', 'hiphop', 'barbara'];
        playlists.forEach(playlist => {
            this.updateElement(`[data-playlist="${playlist}"] .playlist-name`, `radio.playlists.${playlist}`);
        });
    },
    
    updateMuseum() {
        const techniques = ['gaslighting', 'loveBombing', 'triangulation'];
        techniques.forEach(technique => {
            this.updateElement(`[data-technique="${technique}"] .exhibit-title`, `museum.techniques.${technique}.title`);
            this.updateElement(`[data-technique="${technique}"] .exhibit-description`, `museum.techniques.${technique}.description`);
            this.updateElement(`[data-technique="${technique}"] .exhibit-btn`, 'museum.examineButton');
        });
    },
    
    updateChat() {
        this.updateElement('.personality-title', 'chat.personalityTitle');
        this.updateElement('.intro-message .message-content', 'chat.intro');
        this.updateElement('#chat-input', 'chat.placeholder', 'placeholder');
        this.updateElement('.chat-submit', 'chat.sendButton');
        this.updateElement('.chat-help', 'chat.help');
        
        // Update personality buttons
        const personalities = ['narcissist', 'victim', 'controller'];
        personalities.forEach(personality => {
            this.updateElement(`[data-personality="${personality}"] .personality-name`, `chat.personalities.${personality}.name`);
            this.updateElement(`[data-personality="${personality}"] .personality-trait`, `chat.personalities.${personality}.trait`);
        });
    },
    
    updateStudio() {
        // Update studio items based on their content
        const studioItems = Utils.$$('.studio-item');
        studioItems.forEach((item, index) => {
            const title = item.querySelector('.studio-item-title');
            const text = item.querySelector('.studio-item-text');
            
            if (title && text) {
                switch(index) {
                    case 0:
                        title.textContent = this.t('studio.team.title');
                        text.textContent = this.t('studio.team.description');
                        break;
                    case 1:
                        title.textContent = this.t('studio.heart.title');
                        text.textContent = this.t('studio.heart.description');
                        break;
                    case 2:
                        title.textContent = this.t('studio.expert.title');
                        text.textContent = this.t('studio.expert.description');
                        break;
                    case 3:
                        title.textContent = this.t('studio.welcome.title');
                        text.textContent = this.t('studio.welcome.description');
                        break;
                }
            }
        });
    },
    
    updateViolenceLoop() {
        this.updateElement('.cycle-phase-title', 'violenceLoop.currentPhase');
        this.updateElement('.cycle-phase-description', 'violenceLoop.phaseDescription');
        this.updateElement('.switcher-title', 'violenceLoop.perspectives.title');
        
        const phases = ['tension', 'explosion', 'honeymoon', 'calm'];
        phases.forEach(phase => {
            this.updateElement(`[data-phase="${phase}"] .phase-name`, `violenceLoop.phases.${phase}`);
        });
        
        const perspectives = ['victim', 'manipulator', 'observer'];
        perspectives.forEach(perspective => {
            this.updateElement(`[data-perspective="${perspective}"]`, `violenceLoop.perspectives.${perspective}`);
        });
    },
    
    updateGuide() {
        this.updateElement('.guide-intro', 'guide.intro');
        this.updateElement('.progress-text', 'guide.progress');
    },
    
    updateFinal() {
        this.updateElement('.final-text', 'final.description');
        
        const lessons = ['recognition', 'resistance', 'freedom'];
        lessons.forEach(lesson => {
            this.updateElement(`[data-lesson="${lesson}"] .lesson-title`, `final.lessons.${lesson}.title`);
            this.updateElement(`[data-lesson="${lesson}"] .lesson-text`, `final.lessons.${lesson}.description`);
        });
        
        this.updateElement('.certificate-title', 'final.certificate.title');
        this.updateElement('.certificate-text', 'final.certificate.description');
        this.updateElement('.certificate-btn', 'final.certificate.button');
    },
    
    updateFooter() {
        this.updateElement('.footer-title', 'footer.title');
        this.updateElement('.footer-description', 'footer.description');
        this.updateElement('.footer-copyright', 'footer.copyright');
        this.updateElement('.footer-mission', 'footer.mission');
        this.updateElement('.footer-disclaimer', 'footer.disclaimer');
    },
    
    updateModals() {
        this.updateElement('#note-modal-title', 'notes.title');
        this.updateElement('label[for="note-date"]', 'notes.date');
        this.updateElement('label[for="note-name"]', 'notes.name');
        this.updateElement('label[for="note-text"]', 'notes.text');
        this.updateElement('#modal-close-btn', 'notes.close');
        
        // Update note form placeholders
        const nameInput = Utils.$('#note-name');
        if (nameInput) nameInput.placeholder = this.t('notes.namePlaceholder');
        
        const textInput = Utils.$('#note-text');
        if (textInput) textInput.placeholder = this.t('notes.textPlaceholder');
    },
    
    updateFAB() {
        this.updateElement('[data-action="emergency"] .fab-label', 'fab.emergency.label');
        this.updateElement('[data-action="quick-test"] .fab-label', 'fab.quickTest.label');
        this.updateElement('[data-action="progress"] .fab-label', 'fab.progress.label');
    },
    
    updateMiscElements() {
        // Update back to top button
        this.updateElement('.back-to-top-text', 'backToTop.text');
        
        // Update pressure bar
        this.updateElement('.pressure-label', 'pressure.label');
        
        // Update PWA banner
        this.updateElement('.pwa-banner-text', 'pwa.banner');
        this.updateElement('#pwa-install-btn', 'pwa.install');
        this.updateElement('.manipulation-hint small', 'pwa.hint');
        
        // Update urgency timer
        this.updateElement('.urgency-text', 'urgency.session');
        
        // Update listener count text
        const listenerCount = Utils.$('.listener-count');
        if (listenerCount) {
            const count = listenerCount.dataset.count || '1,247';
            listenerCount.innerHTML = `
                <span class="listener-icon">👥</span>
                <span class="count-number" data-count="${count}">${count}</span> ${this.t('header.listeners')}
            `;
        }
    },
    
    getCurrentResistanceLevel() {
        // This would be calculated based on user progress
        // For now, return a default
        return 'beginner';
    },
    
    // Translation helper function
    t(key, params = {}) {
        if (!AppState.isLanguageLoaded) return key;
        
        const keys = key.split('.');
        let value = AppState.translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                console.warn(`Translation key not found: ${key}`);
                return key;
            }
        }
        
        // Simple parameter replacement
        if (typeof value === 'string' && Object.keys(params).length > 0) {
            Object.keys(params).forEach(param => {
                value = value.replace(`{${param}}`, params[param]);
            });
        }
        
        return value;
    }
};

// Add CSS for language selector
const languageSelectorCSS = `
.language-selector {
    display: flex;
    gap: var(--spacing-xs);
    align-items: center;
}

.lang-btn {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--color-surface-light);
    color: var(--color-text-muted);
    border: 1px solid var(--color-surface-lighter);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
}

.lang-btn:hover {
    background: var(--color-surface-lighter);
    color: var(--color-text);
    transform: translateY(-1px);
}

.lang-btn.active {
    background: var(--color-primary);
    color: var(--color-background);
    border-color: var(--color-primary-light);
}

.lang-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

@media (max-width: 768px) {
    .language-selector {
        margin-top: var(--spacing-sm);
    }
    
    .lang-btn {
        padding: var(--spacing-sm);
        font-size: var(--font-size-sm);
    }
}
`;

// Inject language selector CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = languageSelectorCSS;
document.head.appendChild(styleSheet);

// ===== UTILITY FUNCTIONS =====
const Utils = {
    // DOM helpers
    $(selector) {
        return document.querySelector(selector);
    },
    
    $$(selector) {
        return document.querySelectorAll(selector);
    },
    
    // Debounce function
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
    },
    
    // Generate safe ID from filename
    generateId(filepath) {
        if (!filepath || typeof filepath !== 'string') return 'track';
        const filename = filepath.split('/').pop();
        return filename.replace(/\.mp3$/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    },
    
    // Generate human-readable title
    generateTitle(filepath) {
        if (!filepath || typeof filepath !== 'string') return I18nManager.t('radio.trackInfo');
        
        const filename = filepath.split('/').pop();
        if (!filename) return I18nManager.t('radio.trackInfo');
        
        let title = filename.replace(/\.mp3$/i, '');
        title = title.replace(/Utwor\s*\((\d+)\)/i, 'Utwór $1');
        title = title.replace(/_/g, ' ');
        title = title.replace(/\b\w/g, l => l.toUpperCase());
        
        return title || I18nManager.t('radio.trackInfo');
    },
    
    // Shuffle array in place
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },
    
    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#10b981' : '#f59e0b'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    // Format time
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    
    // Check if user prefers reduced motion
    prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
};

// ===== INFINITY SYMBOL CONTROLLER =====
const InfinityController = {
    init() {
        const symbol = Utils.$('.infinity-symbol');
        if (!symbol) return;
        
        // Apply static class if reduced motion is preferred
        if (Utils.prefersReducedMotion()) {
            symbol.classList.add('infinity--static');
        }
        
        // Set initial speed
        this.setSpeed(CONFIG.ANIMATION_SPEED_MULTIPLIER);
    },
    
    setSpeed(multiplier) {
        const marker = Utils.$('#infinityMarker animateMotion');
        if (marker) {
            const baseDuration = 8; // seconds
            const newDuration = baseDuration / multiplier;
            marker.setAttribute('dur', `${newDuration}s`);
        }
    }
};

// ===== PWA MANAGER =====
const PWAManager = {
    init() {
        this.setupInstallPrompt();
        this.registerServiceWorker();
    },
    
    setupInstallPrompt() {
        const banner = Utils.$('#pwa-install-banner');
        const installBtn = Utils.$('#pwa-install-btn');
        const closeBtn = Utils.$('#pwa-close-btn');
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            AppState.deferredPrompt = e;
            if (banner) banner.classList.remove('hidden');
        });
        
        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (AppState.deferredPrompt) {
                    AppState.deferredPrompt.prompt();
                    const { outcome } = await AppState.deferredPrompt.userChoice;
                    if (outcome === 'accepted' && banner) {
                        banner.classList.add('hidden');
                    }
                    AppState.deferredPrompt = null;
                }
            });
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (banner) banner.classList.add('hidden');
            });
        }
        
        // Hide banner after app is installed
        window.addEventListener('appinstalled', () => {
            if (banner) banner.classList.add('hidden');
        });
    },
    
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('Service Worker registered:', reg.scope))
                    .catch(err => console.error('Service Worker registration failed:', err));
            });
        }
    }
};

// ===== UI MANAGER =====
const UIManager = {
    init() {
        this.setupScrollEffects();
        this.setupModalHandlers();
        this.setupNavigationHandlers();
        this.setupFloatingActionButton();
        this.setupBackToTop();
        this.setupEasterEggs();
    },
    
    setupScrollEffects() {
        let ticking = false;
        
        const updateScrollEffects = () => {
            const scrolled = window.pageYOffset;
            const backToTop = Utils.$('#back-to-top');
            
            if (backToTop) {
                if (scrolled > CONFIG.SCROLL_THRESHOLD) {
                    backToTop.classList.remove('hidden');
                } else {
                    backToTop.classList.add('hidden');
                }
            }
            
            ticking = false;
        };
        
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(updateScrollEffects);
                ticking = true;
            }
        });
    },
    
    setupModalHandlers() {
        // Note modal
        const noteModal = Utils.$('#note-modal');
        const noteForm = Utils.$('#note-form');
        const modalCloseBtn = Utils.$('#modal-close-btn');
        
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }
        
        if (noteForm) {
            noteForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleNoteSubmission();
            });
        }
        
        // Close modal on backdrop click
        if (noteModal) {
            noteModal.addEventListener('click', (e) => {
                if (e.target === noteModal) {
                    this.closeModal();
                }
            });
        }
        
        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && AppState.isModalOpen) {
                this.closeModal();
            }
        });
    },
    
    setupNavigationHandlers() {
        const menuToggle = Utils.$('#menu-toggle');
        const mobileMenu = Utils.$('#mobile-menu');
        
        if (menuToggle && mobileMenu) {
            menuToggle.addEventListener('click', () => {
                const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
                menuToggle.setAttribute('aria-expanded', (!isExpanded).toString());
                mobileMenu.classList.toggle('hidden');
            });
        }
        
        // Smooth scrolling for navigation links
        Utils.$$('a[href^="#"]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = Utils.$(link.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                    // Close mobile menu if open
                    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
                        mobileMenu.classList.add('hidden');
                        if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
                    }
                }
            });
        });
    },
    
    setupFloatingActionButton() {
        const fabMain = Utils.$('#fab-main');
        const fabMenu = Utils.$('.fab-menu');
        
        if (fabMain && fabMenu) {
            fabMain.addEventListener('click', () => {
                fabMenu.classList.toggle('hidden');
            });
            
            // Handle FAB item clicks
            Utils.$$('.fab-item').forEach(item => {
                item.addEventListener('click', () => {
                    const action = item.dataset.action;
                    this.handleFABAction(action);
                    fabMenu.classList.add('hidden');
                });
            });
        }
    },
    
    setupBackToTop() {
        const backToTop = Utils.$('#back-to-top');
        if (backToTop) {
            backToTop.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    },
    
    setupEasterEggs() {
        // Konami code easter egg
        let konamiCode = [];
        const konamiSequence = [
            'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
            'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
            'KeyB', 'KeyA'
        ];
        
        document.addEventListener('keydown', (e) => {
            konamiCode.push(e.code);
            
            if (konamiCode.length > konamiSequence.length) {
                konamiCode.shift();
            }
            
            if (konamiCode.length === konamiSequence.length &&
                konamiCode.every((code, index) => code === konamiSequence[index])) {
                this.showEasterEgg();
                konamiCode = [];
            }
        });
        
        // Hidden clickable areas
        Utils.$$('.easter-egg-area').forEach(area => {
            area.addEventListener('click', () => {
                this.showEasterEgg();
            });
        });
    },
    
    showEasterEgg() {
        const easterEgg = Utils.$('#konami-easter-egg');
        const closeBtn = Utils.$('#easter-egg-close');
        
        if (easterEgg) {
            easterEgg.classList.remove('hidden');
            
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    easterEgg.classList.add('hidden');
                });
            }
        }
        
        Utils.showToast(I18nManager.t('easterEgg.title'), 'success');
    },
    
    openModal(modalId = 'note-modal') {
        const modal = Utils.$(`#${modalId}`);
        if (modal) {
            modal.classList.remove('hidden');
            AppState.isModalOpen = true;
            
            // Set current date
            const dateInput = Utils.$('#note-date');
            if (dateInput) {
                dateInput.value = new Date().toISOString().split('T')[0];
            }
            
            // Focus first input
            const firstInput = modal.querySelector('input, textarea');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    },
    
    closeModal() {
        const modal = Utils.$('#note-modal');
        if (modal) {
            modal.classList.add('hidden');
            AppState.isModalOpen = false;
            
            // Reset form
            const form = Utils.$('#note-form');
            if (form) form.reset();
        }
    },
    
    handleNoteSubmission() {
        const formData = new FormData(Utils.$('#note-form'));
        const noteData = {
            date: formData.get('date'),
            name: formData.get('name') || 'Anonimowy',
            category: formData.get('category'),
            text: formData.get('text'),
            mood: Utils.$('.mood-btn-form.active')?.dataset.mood || 'neutral'
        };
        
        // Save to localStorage
        const notes = JSON.parse(localStorage.getItem('radio-adamowo-notes') || '[]');
        notes.push({ ...noteData, timestamp: Date.now() });
        localStorage.setItem('radio-adamowo-notes', JSON.stringify(notes));
        
        Utils.showToast(I18nManager.t('common.success'), 'success');
        this.closeModal();
    },
    
    handleFABAction(action) {
        switch (action) {
            case 'emergency':
                window.open('tel:800120002', '_blank');
                break;
            case 'quick-test':
                Utils.showToast(I18nManager.t('common.loading'), 'info');
                break;
            case 'progress':
                this.showProgressModal();
                break;
        }
    },
    
    showProgressModal() {
        // Implementation for progress modal
        Utils.showToast(I18nManager.t('common.loading'), 'info');
    }
};

// ===== KEYBOARD MANAGER =====
const KeyboardManager = {
    init() {
        document.addEventListener('keydown', (e) => {
            // Don't handle shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            switch (e.key) {
                case CONFIG.SHORTCUTS.PLAY_PAUSE:
                    e.preventDefault();
                    AudioPlayer.togglePlayPause();
                    break;
                case CONFIG.SHORTCUTS.NEXT:
                    e.preventDefault();
                    AudioPlayer.next();
                    break;
                case CONFIG.SHORTCUTS.PREV:
                    e.preventDefault();
                    AudioPlayer.prev();
                    break;
                case CONFIG.SHORTCUTS.MUTE:
                    e.preventDefault();
                    AudioPlayer.toggleMute();
                    break;
                case CONFIG.SHORTCUTS.SHUFFLE:
                    e.preventDefault();
                    AudioPlayer.toggleShuffle();
                    break;
                case CONFIG.SHORTCUTS.HOME:
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    break;
            }
        });
    }
};

// ===== NOTES MANAGER =====
const NotesManager = {
    init() {
        this.setupMoodButtons();
        this.loadSavedNotes();
    },
    
    setupMoodButtons() {
        Utils.$$('.mood-btn-form').forEach(btn => {
            btn.addEventListener('click', () => {
                Utils.$$('.mood-btn-form').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    },
    
    loadSavedNotes() {
        const notes = JSON.parse(localStorage.getItem('radio-adamowo-notes') || '[]');
        console.log(`Loaded ${notes.length} saved notes`);
    }
};

// ===== CHAT SIMULATOR =====
const ChatSimulator = {
    init() {
        this.setupPersonalitySelector();
        this.setupChatForm();
        this.setupSuggestions();
        this.currentPersonality = 'narcissist';
    },
    
    setupPersonalitySelector() {
        Utils.$$('.personality-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Utils.$$('.personality-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentPersonality = btn.dataset.personality;
                this.resetChat();
            });
        });
    },
    
    setupChatForm() {
        const chatForm = Utils.$('#chat-form');
        if (chatForm) {
            chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleChatSubmission();
            });
        }
        
        const analysisToggle = Utils.$('#analysis-toggle');
        if (analysisToggle) {
            analysisToggle.addEventListener('click', () => {
                analysisToggle.classList.toggle('active');
                this.toggleAnalysis();
            });
        }
    },
    
    setupSuggestions() {
        Utils.$$('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = Utils.$('#chat-input');
                if (input) {
                    input.value = this.getSuggestionText(btn.dataset.response);
                    input.focus();
                }
            });
        });
    },
    
    handleChatSubmission() {
        const input = Utils.$('#chat-input');
        if (!input || !input.value.trim()) return;
        
        const message = input.value.trim();
        this.addMessage(message, 'user');
        input.value = '';
        
        // Simulate AI response
        setTimeout(() => {
            const response = this.generateAIResponse(message);
            this.addMessage(response.text, 'ai', response.techniques);
        }, 1000 + Math.random() * 2000);
    },
    
    addMessage(text, sender, techniques = []) {
        const container = Utils.$('#chat-container');
        if (!container) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = sender === 'user' ? '👤' : '🤖';
        
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${sender}`;
        
        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = text;
        
        bubble.appendChild(content);
        
        if (techniques.length > 0) {
            const analysis = document.createElement('div');
            analysis.className = 'message-analysis';
            analysis.innerHTML = `
                <span class="analysis-tag">💡 ${I18nManager.t('chat.help')}: ${techniques.join(', ')}</span>
            `;
            bubble.appendChild(analysis);
        }
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(bubble);
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    },
    
    generateAIResponse(userMessage) {
        const responses = this.getPersonalityResponses();
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        return {
            text: randomResponse.text,
            techniques: randomResponse.techniques
        };
    },
    
    getPersonalityResponses() {
        const responses = {
            narcissist: [
                {
                    text: "Widzę, że nie rozumiesz mojej wyjątkowej perspektywy. To normalne - niewiele osób jest na moim poziomie intelektualnym.",
                    techniques: ["Gaslighting", "Wyższość"]
                },
                {
                    text: "Zawsze wiedziałem, że masz problemy z zrozumieniem złożonych koncepcji. Może powinieneś więcej słuchać, a mniej mówić.",
                    techniques: ["Podważanie kompetencji", "Gaslighting"]
                }
            ],
            victim: [
                {
                    text: "Po tym wszystkim co dla ciebie zrobiłem... Myślałem, że jesteś inny, ale widzę, że też mnie zranisz jak wszyscy.",
                    techniques: ["Szantaż emocjonalny", "Poczucie winy"]
                },
                {
                    text: "Nikt mnie nie rozumie. Wszyscy mnie opuszczają. Pewnie ty też niedługo odejdziesz...",
                    techniques: ["Manipulacja współczuciem", "Szantaż emocjonalny"]
                }
            ],
            controller: [
                {
                    text: "Myślę, że powinieneś ograniczyć kontakt z tymi osobami. One źle na ciebie wpływają. Tylko ja naprawdę cię rozumiem.",
                    techniques: ["Izolacja", "Kontrola"]
                },
                {
                    text: "Nie podobają mi się twoje ostatnie decyzje. Jeśli naprawdę mnie kochasz, zmienisz swoje zachowanie.",
                    techniques: ["Kontrola", "Szantaż emocjonalny"]
                }
            ]
        };
        
        return responses[this.currentPersonality] || responses.narcissist;
    },
    
    getSuggestionText(type) {
        const suggestions = {
            healthy: "Rozumiem twoją perspektywę, ale nie zgadzam się z tym podejściem.",
            assertive: "To nie jest w porządku. Proszę, abyś przestał używać takiego tonu.",
            vulnerable: "Może masz rację... Przepraszam, jeśli cię zawiodłem."
        };
        
        return suggestions[type] || "";
    },
    
    resetChat() {
        const container = Utils.$('#chat-container');
        if (container) {
            // Keep only the intro message
            const introMessage = container.querySelector('.intro-message');
            container.innerHTML = '';
            if (introMessage) {
                container.appendChild(introMessage);
            }
        }
    },
    
    toggleAnalysis() {
        const analysisElements = Utils.$$('.message-analysis');
        analysisElements.forEach(el => {
            el.classList.toggle('hidden');
        });
    }
};

// ===== SINS GUIDE =====
const SinsGuide = {
    init() {
        const container = Utils.$('.sins-grid');
        if (!container) return;
        
        this.generateSinsGrid();
    },
    
    generateSinsGrid() {
        const container = Utils.$('.sins-grid');
        if (!container) return;
        
        const sins = [
            {
                title: I18nManager.t('guide.sins.sin1.title'),
                description: I18nManager.t('guide.sins.sin1.description'),
                example: I18nManager.t('guide.sins.sin1.example'),
                detection: I18nManager.t('guide.sins.sin1.detection')
            },
            {
                title: I18nManager.t('guide.sins.sin2.title'),
                description: I18nManager.t('guide.sins.sin2.description'),
                example: I18nManager.t('guide.sins.sin2.example'),
                detection: I18nManager.t('guide.sins.sin2.detection')
            },
            {
                title: I18nManager.t('guide.sins.sin3.title'),
                description: I18nManager.t('guide.sins.sin3.description'),
                example: I18nManager.t('guide.sins.sin3.example'),
                detection: I18nManager.t('guide.sins.sin3.detection')
            },
            {
                title: I18nManager.t('guide.sins.sin4.title'),
                description: I18nManager.t('guide.sins.sin4.description'),
                example: I18nManager.t('guide.sins.sin4.example'),
                detection: I18nManager.t('guide.sins.sin4.detection')
            },
            {
                title: I18nManager.t('guide.sins.sin5.title'),
                description: I18nManager.t('guide.sins.sin5.description'),
                example: I18nManager.t('guide.sins.sin5.example'),
                detection: I18nManager.t('guide.sins.sin5.detection')
            },
            {
                title: I18nManager.t('guide.sins.sin6.title'),
                description: I18nManager.t('guide.sins.sin6.description'),
                example: I18nManager.t('guide.sins.sin6.example'),
                detection: I18nManager.t('guide.sins.sin6.detection')
            },
            {
                title: I18nManager.t('guide.sins.sin7.title'),
                description: I18nManager.t('guide.sins.sin7.description'),
                example: I18nManager.t('guide.sins.sin7.example'),
                detection: I18nManager.t('guide.sins.sin7.detection')
            },
            {
                title: I18nManager.t('guide.sins.sin8.title'),
                description: I18nManager.t('guide.sins.sin8.description'),
                example: I18nManager.t('guide.sins.sin8.example'),
                detection: I18nManager.t('guide.sins.sin8.detection')
            }
        ];
        
        container.innerHTML = sins.map(sin => `
            <article class="sin-item">
                <h3 class="sin-title">${sin.title}</h3>
                <p class="sin-description">${sin.description}</p>
                <p class="sin-example"><strong>${I18nManager.t('guide.sins.sin1.example').split(':')[0]}:</strong> ${sin.example}</p>
                <h4 class="sin-detection-title">${I18nManager.t('guide.detectionTitle')}</h4>
                <ul class="sin-detection-list">
                    ${sin.detection.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </article>
        `).join('');
    }
};

// ===== AUDIO PLAYER =====
const AudioPlayer = {
    async init() {
        this.setupEventListeners();
        this.checkLiveStreamAvailability();
    },
    
    checkLiveStreamAvailability() {
        const liveContainer = Utils.$('#live-toggle-container');
        if (CONFIG.STREAM_URL && CONFIG.STREAM_URL.trim()) {
            if (liveContainer) liveContainer.classList.remove('hidden');
            this.setupLiveToggle();
        } else {
            if (liveContainer) liveContainer.classList.add('hidden');
        }
    },
    
    setupLiveToggle() {
        const liveToggle = Utils.$('#live-toggle');
        if (!liveToggle) return;
        
        liveToggle.addEventListener('click', () => {
            const isPressed = liveToggle.getAttribute('aria-pressed') === 'true';
            this.toggleLiveMode(!isPressed);
        });
    },
    
    toggleLiveMode(enable) {
        const liveToggle = Utils.$('#live-toggle');
        if (!liveToggle) return;
        
        AppState.isLiveMode = enable;
        liveToggle.setAttribute('aria-pressed', enable.toString());
        
        if (enable) {
            Utils.showToast(I18nManager.t('common.success'), 'success');
        } else {
            Utils.showToast(I18nManager.t('common.success'), 'success');
        }
    },
    
    async initializeAudio() {
        if (AppState.isAudioInitialized) return;
        
        try {
            AppState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (AppState.audioContext.state === 'suspended') {
                await AppState.audioContext.resume();
            }
            
            AppState.analyser = AppState.audioContext.createAnalyser();
            AppState.analyser.fftSize = CONFIG.VISUALIZER_FFT_SIZE;
            
            AppState.gainNode = AppState.audioContext.createGain();
            AppState.gainNode.gain.value = AppState.currentVolume;
            
            const audioElement = Utils.$('#radio-player');
            if (audioElement) {
                AppState.audioSource = AppState.audioContext.createMediaElementSource(audioElement);
                AppState.audioSource
                    .connect(AppState.gainNode)
                    .connect(AppState.analyser)
                    .connect(AppState.audioContext.destination);
            }
            
            AppState.isAudioInitialized = true;
            console.log('Web Audio API initialized successfully');
            
            this.enableControls();
            
            Utils.showToast(I18nManager.t('common.success'), 'success');
            
        } catch (error) {
            console.error('Could not initialize Web Audio API:', error);
            Utils.showToast(I18nManager.t('common.error'), 'error');
        }
    },
    
    setupEventListeners() {
        const audioElement = Utils.$('#radio-player');
        if (!audioElement) return;
        
        audioElement.addEventListener('play', () => {
            AppState.isPlaying = true;
            this.updatePlayButton();
        });
        
        audioElement.addEventListener('pause', () => {
            AppState.isPlaying = false;
            this.updatePlayButton();
        });
        
        audioElement.addEventListener('ended', () => {
            if (!AppState.isLiveMode) {
                this.next();
            }
        });
        
        audioElement.addEventListener('timeupdate', () => {
            this.updateProgress();
        });
        
        audioElement.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.handleAudioError();
        });
        
        // Control buttons
        const playPauseBtn = Utils.$('#play-pause-btn');
        const nextBtn = Utils.$('#next-btn');
        const prevBtn = Utils.$('#prev-btn');
        const shuffleBtn = Utils.$('#shuffle-btn');
        const muteBtn = Utils.$('#mute-btn');
        
        if (playPauseBtn) playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        if (nextBtn) nextBtn.addEventListener('click', () => this.next());
        if (prevBtn) prevBtn.addEventListener('click', () => this.prev());
        if (shuffleBtn) shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        if (muteBtn) muteBtn.addEventListener('click', () => this.toggleMute());
    },
    
    enableControls() {
        Utils.$$('#play-pause-btn, #next-btn, #prev-btn, #shuffle-btn, #mute-btn').forEach(btn => {
            if (btn) btn.disabled = false;
        });
    },
    
    async togglePlayPause() {
        if (!AppState.isAudioInitialized) return;
        
        const audioElement = Utils.$('#radio-player');
        if (!audioElement) return;
        
        if (AppState.audioContext && AppState.audioContext.state === 'suspended') {
            await AppState.audioContext.resume();
        }
        
        try {
            if (AppState.isPlaying) {
                audioElement.pause();
            } else {
                await audioElement.play();
            }
        } catch (error) {
            console.error('Playback error:', error);
            Utils.showToast(I18nManager.t('common.error'), 'error');
        }
    },
    
    next() {
        Utils.showToast(I18nManager.t('common.success'), 'info');
    },
    
    prev() {
        Utils.showToast(I18nManager.t('common.success'), 'info');
    },
    
    toggleShuffle() {
        AppState.isShuffled = !AppState.isShuffled;
        
        const shuffleBtn = Utils.$('#shuffle-btn');
        if (shuffleBtn) {
            shuffleBtn.style.opacity = AppState.isShuffled ? '1' : '0.6';
            shuffleBtn.setAttribute('aria-pressed', AppState.isShuffled.toString());
        }
        
        Utils.showToast(AppState.isShuffled ? I18nManager.t('common.success') : I18nManager.t('common.success'), 'info');
    },
    
    toggleMute() {
        AppState.isMuted = !AppState.isMuted;
        
        const audioElement = Utils.$('#radio-player');
        const muteBtn = Utils.$('#mute-btn');
        
        if (audioElement) {
            audioElement.muted = AppState.isMuted;
        }
        
        if (AppState.gainNode) {
            AppState.gainNode.gain.value = AppState.isMuted ? 0 : AppState.currentVolume;
        }
        
        if (muteBtn) {
            muteBtn.textContent = AppState.isMuted ? '🔇' : '🔊';
            muteBtn.setAttribute('aria-label', AppState.isMuted ? I18nManager.t('radio.controls.mute') : I18nManager.t('radio.controls.mute'));
        }
    },
    
    updatePlayButton() {
        const playIcon = Utils.$('#play-icon');
        const pauseIcon = Utils.$('#pause-icon');
        
        if (AppState.isPlaying) {
            if (playIcon) playIcon.classList.add('hidden');
            if (pauseIcon) pauseIcon.classList.remove('hidden');
        } else {
            if (playIcon) playIcon.classList.remove('hidden');
            if (pauseIcon) pauseIcon.classList.add('hidden');
        }
    },
    
    updateProgress() {
        const audioElement = Utils.$('#radio-player');
        const progressBar = Utils.$('.progress-bar');
        
        if (audioElement && progressBar && !AppState.isLiveMode) {
            const progress = (audioElement.currentTime / audioElement.duration) * 100;
            progressBar.style.width = `${progress || 0}%`;
            
            const progressContainer = Utils.$('#track-progress');
            if (progressContainer) {
                progressContainer.setAttribute('aria-valuenow', Math.round(progress || 0));
            }
        }
    },
    
    handleAudioError() {
        Utils.showToast(I18nManager.t('common.error'), 'error');
    }
};

// ===== MAIN APPLICATION =====
class RadioAdamowoApp {
    constructor() {
        this.initializeApp();
    }
    
    async initializeApp() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    async init() {
        try {
            console.log('🎵 Initializing Radio Adamowo...');
            
            // Initialize i18n first
            await I18nManager.init();
            
            // Initialize core components
            InfinityController.init();
            PWAManager.init();
            UIManager.init();
            KeyboardManager.init();
            
            // Initialize content generators
            SinsGuide.init();
            
            // Initialize interactive components
            NotesManager.init();
            ChatSimulator.init();
            
            // Initialize audio system (after user interaction)
            this.setupAutoplayOverlay();
            
            console.log('✅ Radio Adamowo initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Radio Adamowo:', error);
            Utils.showToast('Błąd inicjalizacji aplikacji', 'error');
        }
    }
    
    setupAutoplayOverlay() {
        const overlay = Utils.$('#autoplay-overlay');
        const startBtns = Utils.$$('[id^="start-btn"]');
        
        startBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    // Hide overlay with animation
                    if (overlay) {
                        overlay.style.opacity = '0';
                        setTimeout(() => overlay.classList.add('hidden'), 500);
                    }
                    
                    // Initialize audio system
                    await AudioPlayer.initializeAudio();
                    await AudioPlayer.init();
                    
                    Utils.showToast(I18nManager.t('common.success'), 'success');
                    
                } catch (error) {
                    console.error('Failed to initialize audio system:', error);
                    Utils.showToast(I18nManager.t('common.error'), 'error');
                }
            });
        });
    }
}

// ===== GLOBAL FUNCTIONS FOR EXTERNAL ACCESS =====
window.RadioAdamowo = {
    // Infinity symbol speed control
    setInfinitySpeed(multiplier) {
        InfinityController.setSpeed(multiplier);
    },
    
    // Audio controls
    play() { return AudioPlayer.togglePlayPause(); },
    next() { return AudioPlayer.next(); },
    prev() { return AudioPlayer.prev(); },
    shuffle() { return AudioPlayer.toggleShuffle(); },
    mute() { return AudioPlayer.toggleMute(); },
    
    // Language controls
    switchLanguage(langCode) { return I18nManager.switchLanguage(langCode); },
    getCurrentLanguage() { return AppState.currentLanguage; },
    t(key, params) { return I18nManager.t(key, params); },
    
    // Utility functions
    showToast(message, type) { return Utils.showToast(message, type); },
    
    // App state (read-only)
    get state() {
        return {
            isPlaying: AppState.isPlaying,
            isLiveMode: AppState.isLiveMode,
            isShuffled: AppState.isShuffled,
            isMuted: AppState.isMuted,
            currentLanguage: AppState.currentLanguage,
            isLanguageLoaded: AppState.isLanguageLoaded
        };
    }
};

// ===== INITIALIZE APPLICATION =====
new RadioAdamowoApp();