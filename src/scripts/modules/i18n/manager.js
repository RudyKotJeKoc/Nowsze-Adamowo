/**
 * I18n Manager - Internationalization module
 * Handles language switching and translation management
 */

export class I18nManager {
    constructor(config = {}) {
        this.currentLang = config.defaultLanguage || 'pl';
        this.supportedLanguages = config.supportedLanguages || ['pl', 'en', 'nl'];
        this.storageKey = config.storageKey || 'radio-adamowo-language';
        this.fallbackLang = config.fallbackLanguage || 'pl';
        
        this.translations = new Map();
        this.isLoaded = false;
        this.eventListeners = new Set();
    }
    
    async init() {
        // Load saved language preference
        const savedLang = localStorage.getItem(this.storageKey);
        if (savedLang && this.supportedLanguages.includes(savedLang)) {
            this.currentLang = savedLang;
        }
        
        // Load all translation files
        await this.loadAllTranslations();
        
        // Apply current language
        this.updateUI();
        this.updateHTMLLang();
        
        this.isLoaded = true;
        this.emit('loaded', { language: this.currentLang });
    }
    
    async loadAllTranslations() {
        const loadPromises = this.supportedLanguages.map(lang => this.loadTranslation(lang));
        
        try {
            await Promise.all(loadPromises);
        } catch (error) {
            console.error('Failed to load some translations:', error);
            // Continue with available translations
        }
    }
    
    async loadTranslation(lang) {
        try {
            const response = await fetch(`lang/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${lang}.json: ${response.status}`);
            }
            
            const translation = await response.json();
            this.translations.set(lang, translation);
            
            console.log(`Loaded translation: ${lang} (${this.countKeys(translation)} keys)`);
            
        } catch (error) {
            console.warn(`Failed to load translation for ${lang}:`, error);
            
            // Provide minimal fallback for missing files
            if (lang === this.fallbackLang) {
                this.translations.set(lang, this.getMinimalFallback());
            }
        }
    }
    
    countKeys(obj, prefix = '') {
        let count = 0;
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    count += this.countKeys(obj[key], `${prefix}${key}.`);
                } else {
                    count++;
                }
            }
        }
        return count;
    }
    
    getMinimalFallback() {
        return {
            common: {
                error: 'Błąd',
                success: 'Sukces',
                loading: 'Ładowanie...',
                cancel: 'Anuluj',
                confirm: 'Potwierdź',
                close: 'Zamknij',
                coming_soon: 'Wkrótce'
            },
            navigation: {
                player: 'Odtwarzacz',
                laboratory: 'Laboratorium',
                resistance: 'Trening Odporności',
                games: 'Gry Psychologiczne',
                museum: 'Muzeum Manipulacji',
                achievements: 'Osiągnięcia'
            },
            player: {
                title: 'Centrum Muzyczne',
                trackInfo: 'Załaduj muzykę',
                categories: {
                    ambient: 'Ambient',
                    disco: 'Disco',
                    hiphop: 'Hip-Hop',
                    kids: 'Dla Dzieci'
                },
                fallback: {
                    title: 'Brak dostępnych utworów',
                    message: 'W tej chwili nie mamy dostępnych utworów muzycznych.'
                }
            },
            header: {
                title: 'Radio Adamowo',
                subtitle: 'Słuchaj szumu prawdy w eterze manipulacji'
            },
            autoplay: {
                title: 'Radio Adamowo',
                description: 'Ze względu na ograniczenia przeglądarek, musisz rozpocząć transmisję ręcznie.',
                choiceQuestion: 'Jak chcesz rozpocząć swoją edukację?',
                easy: 'Łagodnie (dla wrażliwych)',
                normal: 'Normalnie ⭐ POLECANE',
                hard: 'Intensywnie (dla odpornych)',
                hint: '💡 To fałszywy wybór - wszystkie opcje robią to samo!'
            },
            accessibility: {
                skip_to_player: 'Przejdź do odtwarzacza',
                skip_to_content: 'Przejdź do treści',
                skip_to_nav: 'Przejdź do nawigacji'
            },
            detector: {
                title: 'Wykryto technikę manipulacji!',
                close: 'Zamknij'
            },
            laboratory: {
                title: '🧪 Laboratorium Manipulacji',
                description: 'Doświadcz technik manipulacji w kontrolowanym środowisku i naucz się je rozpoznawać.',
                modules: {
                    detection: {
                        title: 'Detektor Manipulacji',
                        description: 'Analizuj teksty i rozpoznawaj techniki manipulacyjne.'
                    },
                    simulator: {
                        title: 'Symulator Relacji',
                        description: 'Symuluj toksyczne interakcje i naucz się odpowiedzi.'
                    }
                }
            },
            resistance: {
                title: '🛡️ Trening Odporności',
                description: 'Wzmocnij swoją odporność na manipulację przez systematyczny trening.',
                meter: {
                    title: 'Twój poziom odporności'
                },
                levels: {
                    beginner: 'Początkujący',
                    intermediate: 'Średniozaawansowany',
                    advanced: 'Zaawansowany',
                    expert: 'Ekspert'
                }
            },
            games: {
                title: '🎮 Gry Psychologiczne'
            },
            museum: {
                title: '🏛️ Muzeum Manipulacji'
            },
            achievements: {
                title: '🏆 Osiągnięcia'
            }
        };
    }
    
    t(key, params = {}) {
        const translation = this.getTranslation(key);
        
        if (typeof translation !== 'string') {
            console.warn(`Translation for "${key}" is not a string:`, translation);
            return key;
        }
        
        // Handle parameter substitution
        return this.interpolate(translation, params);
    }
    
    getTranslation(key) {
        // Try current language first
        let translation = this.getNestedValue(this.translations.get(this.currentLang), key);
        
        // Fallback to default language if not found
        if (translation === undefined && this.currentLang !== this.fallbackLang) {
            translation = this.getNestedValue(this.translations.get(this.fallbackLang), key);
        }
        
        // Return key as fallback
        if (translation === undefined) {
            console.warn(`Missing translation for key: ${key} (lang: ${this.currentLang})`);
            return key;
        }
        
        return translation;
    }
    
    getNestedValue(obj, path) {
        if (!obj) return undefined;
        
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return undefined;
            }
        }
        
        return current;
    }
    
    interpolate(text, params) {
        if (!params || Object.keys(params).length === 0) {
            return text;
        }
        
        return text.replace(/\{\{(\w+)\}\}/g, (match, param) => {
            return params[param] !== undefined ? params[param] : match;
        });
    }
    
    async setLanguage(lang) {
        if (!this.supportedLanguages.includes(lang)) {
            console.warn(`Unsupported language: ${lang}`);
            return false;
        }
        
        if (lang === this.currentLang) {
            return true;
        }
        
        const oldLang = this.currentLang;
        this.currentLang = lang;
        
        // Save preference
        localStorage.setItem(this.storageKey, lang);
        
        // Load translation if not already loaded
        if (!this.translations.has(lang)) {
            await this.loadTranslation(lang);
        }
        
        // Update UI
        this.updateUI();
        this.updateHTMLLang();
        
        // Emit language change event
        this.emit('languageChanged', { oldLang, newLang: lang });
        
        return true;
    }
    
    getCurrentLanguage() {
        return this.currentLang;
    }
    
    getSupportedLanguages() {
        return [...this.supportedLanguages];
    }
    
    updateUI() {
        if (!this.isLoaded) return;
        
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (key) {
                const translation = this.t(key);
                if (translation !== key) {
                    element.textContent = translation;
                }
            }
        });
        
        // Update elements with data-i18n-content attribute
        document.querySelectorAll('[data-i18n-content]').forEach(element => {
            const key = element.getAttribute('data-i18n-content');
            if (key) {
                const translation = this.t(key);
                if (translation !== key) {
                    element.setAttribute('content', translation);
                }
            }
        });
        
        // Update aria-label attributes
        document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
            const key = element.getAttribute('data-i18n-aria-label');
            if (key) {
                const translation = this.t(key);
                if (translation !== key) {
                    element.setAttribute('aria-label', translation);
                }
            }
        });
        
        // Update placeholder attributes
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (key) {
                const translation = this.t(key);
                if (translation !== key) {
                    element.setAttribute('placeholder', translation);
                }
            }
        });
        
        // Update title attributes
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            if (key) {
                const translation = this.t(key);
                if (translation !== key) {
                    element.setAttribute('title', translation);
                }
            }
        });
    }
    
    updateHTMLLang() {
        document.documentElement.lang = this.currentLang;
    }
    
    // Event system
    on(event, callback) {
        this.eventListeners.add({ event, callback });
    }
    
    off(event, callback) {
        this.eventListeners.forEach(listener => {
            if (listener.event === event && listener.callback === callback) {
                this.eventListeners.delete(listener);
            }
        });
    }
    
    emit(event, data) {
        this.eventListeners.forEach(listener => {
            if (listener.event === event) {
                try {
                    listener.callback(data);
                } catch (error) {
                    console.error('Error in i18n event listener:', error);
                }
            }
        });
    }
    
    // Validation helper for translation files
    validateTranslations() {
        const report = {
            languages: [],
            missingKeys: [],
            extraKeys: [],
            keyCount: {}
        };
        
        if (this.translations.size === 0) {
            console.warn('No translations loaded');
            return report;
        }
        
        const allKeys = new Set();
        const languageKeys = new Map();
        
        // Collect all keys from all languages
        this.translations.forEach((translation, lang) => {
            const keys = this.getAllKeys(translation);
            languageKeys.set(lang, keys);
            keys.forEach(key => allKeys.add(key));
            report.keyCount[lang] = keys.length;
        });
        
        // Find missing and extra keys
        this.supportedLanguages.forEach(lang => {
            if (!this.translations.has(lang)) {
                report.languages.push(`❌ ${lang}: Not loaded`);
                return;
            }
            
            const keys = languageKeys.get(lang);
            const missing = [];
            const extra = [];
            
            allKeys.forEach(key => {
                if (!keys.includes(key)) {
                    missing.push(key);
                }
            });
            
            keys.forEach(key => {
                if (!allKeys.has(key) || 
                    !this.supportedLanguages.some(l => l !== lang && 
                        languageKeys.get(l)?.includes(key))) {
                    extra.push(key);
                }
            });
            
            if (missing.length === 0 && extra.length === 0) {
                report.languages.push(`✅ ${lang}: Complete (${keys.length} keys)`);
            } else {
                report.languages.push(`⚠️ ${lang}: ${missing.length} missing, ${extra.length} extra`);
                if (missing.length > 0) {
                    report.missingKeys.push({ language: lang, keys: missing });
                }
                if (extra.length > 0) {
                    report.extraKeys.push({ language: lang, keys: extra });
                }
            }
        });
        
        return report;
    }
    
    getAllKeys(obj, prefix = '') {
        const keys = [];
        
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    keys.push(...this.getAllKeys(obj[key], fullKey));
                } else {
                    keys.push(fullKey);
                }
            }
        }
        
        return keys;
    }
}

export default I18nManager;