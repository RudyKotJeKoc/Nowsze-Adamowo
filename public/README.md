# Radio Adamowo - Gold Build

Interaktywna platforma edukacyjna o manipulacji psychologicznej. Doświadcz technik manipulacji, naucz się je rozpoznawać i chronić się przed nimi.

## 🎯 Opis Projektu

Radio Adamowo to innowacyjna polska platforma streamingowa, która łączy edukację o manipulacji psychologicznej z funkcjami rozrywki. Aplikacja oferuje:

- **📻 Odtwarzacz Muzyczny**: Priorytetowy, sticky player z obsługą playlist i Media Session API
- **🧪 Laboratorium Manipulacji**: Interaktywne narzędzia do nauki rozpoznawania technik manipulacyjnych
- **🛡️ Trening Odporności**: Systematyczne wzmacnianie odporności na manipulację
- **🌍 Międzynarodowość**: Pełna obsługa 3 języków (PL/EN/NL) z 200+ kluczami tłumaczeń
- **📱 PWA**: Pełne wsparcie dla Progressive Web App z offline funkcjonalnością

## 🏗️ Architektura

### Modularny System
Projekt został przeprojektowany z monolitycznego systemu (1663 linie JS) na modularną architekturę:

```
/public/                    # Główne pliki aplikacji
├── index.html             # Semantic HTML z sticky nav i accessibility
├── styles.css             # CSS z variables, calmer design palette
├── script.js              # Bootstrap - ładuje moduły dynamicznie
├── sw.js                  # Service Worker z cache strategies
├── manifest.json          # PWA manifest z shortcuts
├── data/
│   └── playlist.json      # Extended metadata dla utworów
└── lang/
    ├── pl.json            # Polski (507 kluczy)
    ├── en.json            # Angielski (507 kluczy)
    └── nl.json            # Holenderski (507 kluczy)

/src/scripts/modules/       # Modułowy JavaScript
├── i18n/
│   └── manager.js         # Zarządzanie językami i tłumaczeniami
├── audio/
│   └── player.js          # Audio player z Web Audio API
├── ui/
│   └── manager.js         # Zarządzanie interfejsem użytkownika
├── manipulation/
│   └── detector.js        # Narzędzia edukacyjne
├── services/
│   ├── pwa.js            # PWA functionality
│   ├── storage.js        # Local/session storage management
│   └── analytics.js      # Event tracking i analytics
└── utils/
    └── helpers.js         # Utility functions

/api/                      # PHP Backend z security
├── db_config.php          # MySQL config z security
├── get_csrf_token.php     # CSRF token generation
├── add_comment.php        # Comment system z XSS/CSRF protection
└── get_comments.php       # Comment retrieval z pagination
```

## 🚀 Szybki Start

### Wymagania
- **Node.js** 16+ (dla development)
- **PHP** 7.4+ (dla backend API)
- **MySQL** 5.7+ (dla bazy danych)
- **Apache/Nginx** (dla production)

### Development Setup

1. **Sklonuj repozytorium:**
```bash
git clone https://github.com/RudyKotJeKoc/Nowsze-Adamowo.git
cd Nowsze-Adamowo
```

2. **Zainstaluj zależności:**
```bash
npm install
```

3. **Skonfiguruj bazę danych:**
```bash
# Utwórz bazę danych MySQL
mysql -u root -p
CREATE DATABASE radio_adamowo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'radio_user'@'localhost' IDENTIFIED BY 'secure_password_2024!';
GRANT ALL PRIVILEGES ON radio_adamowo.* TO 'radio_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

4. **Uruchom development server:**
```bash
npm run dev
```

5. **Otwórz w przeglądarce:**
```
http://localhost:3000
```

### Production Setup

1. **Build aplikacji:**
```bash
npm run build
```

2. **Skonfiguruj Apache Virtual Host:**
```apache
<VirtualHost *:80>
    ServerName radio-adamowo.local
    DocumentRoot /path/to/Nowsze-Adamowo/public
    
    <Directory /path/to/Nowsze-Adamowo/public>
        AllowOverride All
        Require all granted
    </Directory>
    
    # API endpoint
    Alias /api /path/to/Nowsze-Adamowo/api
    <Directory /path/to/Nowsze-Adamowo/api>
        AllowOverride All
        Require all granted
        
        # Security headers
        Header always set X-Content-Type-Options nosniff
        Header always set X-Frame-Options DENY
        Header always set X-XSS-Protection "1; mode=block"
    </Directory>
    
    # Enable compression
    LoadModule deflate_module modules/mod_deflate.so
    <Location />
        SetOutputFilter DEFLATE
        SetEnvIfNoCase Request_URI \
            \.(?:gif|jpe?g|png|ico)$ no-gzip dont-vary
        SetEnvIfNoCase Request_URI \
            \.(?:exe|t?gz|zip|bz2|sit|rar)$ no-gzip dont-vary
    </Location>
    
    # Cache static assets
    <FilesMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$">
        ExpiresActive On
        ExpiresDefault "access plus 1 month"
    </FilesMatch>
</VirtualHost>
```

3. **Skonfiguruj HTTPS (Let's Encrypt):**
```bash
sudo certbot --apache -d radio-adamowo.com
```

4. **Skonfiguruj PHP:**
```ini
# W php.ini
post_max_size = 8M
upload_max_filesize = 2M
max_execution_time = 30
memory_limit = 128M

# Włącz OPcache dla production
opcache.enable=1
opcache.memory_consumption=128
opcache.interned_strings_buffer=8
opcache.max_accelerated_files=4000
opcache.revalidate_freq=2
```

## 📱 Progressive Web App (PWA)

### Funkcje PWA
- ✅ **Service Worker**: Cache strategies dla offline functionality
- ✅ **Web App Manifest**: Full screen experience
- ✅ **App Shortcuts**: Quick access do key features
- ✅ **Background Sync**: Sync data when connection restored
- ✅ **Media Session API**: OS-level media controls

### Install Prompts
Aplikacja automatycznie pokazuje install prompt na desktop i mobile po spełnieniu warunków PWA.

### Offline Functionality
- Static assets cached on install
- API responses cached with stale-while-revalidate
- Audio files cached on demand
- Graceful degradation when offline

## 🎨 Design System

### Paleta Kolorów (Calmer Design)
```css
/* Ciepłe, spokojniejsze kolory */
--primary-warm: #e97316;        /* Ciepły pomarańcz */
--primary-dark: #c4641b;        /* Ciemniejszy ciepły pomarańcz */
--accent-warm: #f59e0b;         /* Bursztynowy accent */

/* Backgrounds */
--bg-dark: #1c1917;             /* Bardzo ciemny brązowo-szary */
--bg-medium: #292524;           /* Średnio ciemny brąz */
--bg-soft: #44403c;             /* Miękki ciemny brąz */
```

### Responsywność
- **Mobile First**: Zoptymalizowane dla urządzeń mobilnych
- **Breakpoints**: 480px, 768px, 1024px, 1200px
- **Touch Friendly**: Większe obszary kliknięcia na mobile
- **Accessible**: WCAG AA compliance

## 🌍 Internationalization (i18n)

### Obsługiwane Języki
- **Polski (pl)**: Język domyślny - 507 kluczy
- **Angielski (en)**: 507 kluczy (identyczne z PL)
- **Holenderski (nl)**: 507 kluczy (identyczne z PL)

### Struktura Tłumaczeń
```json
{
  "navigation": {
    "player": "Odtwarzacz",
    "laboratory": "Laboratorium"
  },
  "player": {
    "title": "Centrum Muzyczne",
    "categories": {
      "ambient": "Ambient",
      "disco": "Disco"
    }
  }
}
```

### Dodawanie Nowych Języków
1. Utwórz plik `/public/lang/{kod_języka}.json`
2. Skopiuj strukturę z `pl.json`
3. Przetłumacz wszystkie wartości
4. Dodaj kod języka do `CONFIG.SUPPORTED_LANGUAGES` w `script.js`
5. Dodaj przycisk języka w nawigacji

## 🔒 Security

### Backend Security
- **CSRF Protection**: Token-based protection dla formularzy
- **XSS Prevention**: Input sanitization i output encoding
- **SQL Injection**: Prepared statements w PDO
- **Rate Limiting**: API calls rate limited per IP
- **Input Validation**: Server-side validation wszystkich inputów

### Frontend Security
- **Content Security Policy**: Strict CSP headers
- **Secure Headers**: X-Frame-Options, X-Content-Type-Options
- **HTTPS Only**: Redirect wszystkich HTTP do HTTPS
- **Sanitized Output**: Wszystkie user inputs escaped

## 📊 Analytics & Monitoring

### Built-in Analytics
```javascript
// Track user events
RadioAdamowo.track('audio', 'play', 'ambient', trackDuration);
RadioAdamowo.track('ui', 'navigation', 'laboratory');
RadioAdamowo.track('i18n', 'language_change', 'pl_to_en');
```

### External Integration Ready
- **Google Analytics 4**: Ready for GA4 integration
- **Custom Analytics**: Self-hosted analytics support
- **Error Tracking**: Console errors automatically tracked
- **Performance Monitoring**: Core Web Vitals tracking

## 🎵 Audio System

### Supported Formats
- **MP3**: Primary format
- **WAV**: Uncompressed audio
- **OGG**: Open source alternative

### Audio Features
- **Web Audio API**: Advanced audio processing
- **Media Session API**: OS-level controls
- **Background Playback**: Continues when tab not active
- **Crossfade**: Smooth transitions between tracks
- **Visualization**: Real-time audio visualization

### Playlist Structure
```json
{
  "id": "ambient_001",
  "file": "music/ambient/track.mp3",
  "category": "ambient",
  "metadata": {
    "title": "Track Title",
    "artist": "Radio Adamowo",
    "duration": "04:23",
    "mood": ["calm", "peaceful"],
    "energy": 2,
    "bpm": 60,
    "tags": ["meditation", "ambient"]
  }
}
```

## 🧪 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run test         # Run tests (gdy dostępne)
npm run deploy       # Deploy to production
```

### Code Quality
- **ESLint**: Code linting dla JavaScript
- **Prettier**: Code formatting
- **Modular Architecture**: Clear separation of concerns
- **Error Handling**: Comprehensive error handling
- **Documentation**: Inline code documentation

### Testing Strategy
- **Unit Tests**: Test individual modules
- **Integration Tests**: Test module interactions
- **E2E Tests**: Test complete user flows
- **Accessibility Tests**: WCAG compliance testing

## 🚀 Performance Optimization

### Implemented Optimizations
- **Code Splitting**: Modules loaded on demand
- **Image Optimization**: Compressed images with proper formats
- **Service Worker Caching**: Aggressive caching strategies
- **Minification**: CSS/JS minified in production
- **Gzip Compression**: Server-side compression enabled

### Performance Targets
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **First Input Delay**: < 100ms
- **Cumulative Layout Shift**: < 0.1

## 🛠️ Troubleshooting

### Common Issues

**Audio nie odtwarza się:**
```javascript
// Check audio context state
console.log('Audio Context State:', audioContext.state);
// User interaction required for autoplay
```

**Service Worker nie działa:**
```javascript
// Check registration
navigator.serviceWorker.ready.then(reg => console.log('SW ready:', reg));
```

**Tłumaczenia nie ładują się:**
```javascript
// Check network tab for 404s on lang files
// Verify file paths in CONFIG.MODULE_PATHS
```

**Performance issues:**
```javascript
// Enable performance monitoring
performance.getEntriesByType('navigation');
performance.getEntriesByType('resource');
```

### Debug Mode
```javascript
// Enable debug mode
localStorage.setItem('radio-adamowo-debug', 'true');
// Then reload page for detailed logs
```

## 📝 Contributing

### Development Flow
1. Fork repository
2. Create feature branch
3. Make changes following coding standards
4. Test changes thoroughly
5. Submit pull request with detailed description

### Coding Standards
- **ES6+ Modules**: Use import/export
- **Async/Await**: Prefer over Promises chains
- **Error Handling**: Always handle errors gracefully
- **Comments**: Document complex logic
- **Accessibility**: Follow WCAG guidelines

## 📄 License

Ten projekt jest dostępny na licencji MIT. Zobacz plik `LICENSE` dla szczegółów.

## 🤝 Support

Jeśli napotkasz problemy lub masz pytania:

1. Sprawdź sekcję [Troubleshooting](#troubleshooting)
2. Przeszukaj [Issues](https://github.com/RudyKotJeKoc/Nowsze-Adamowo/issues)
3. Utwórz nowy Issue z detalami problemu
4. Kontakt: [support@radio-adamowo.pl](mailto:support@radio-adamowo.pl)

---

**Radio Adamowo** - *Słuchaj szumu prawdy w eterze manipulacji* 📻✨