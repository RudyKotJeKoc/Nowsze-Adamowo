/**
 * Audio Player Module - Handles audio playback, playlists, and Media Session API
 */

export class AudioPlayer {
    constructor(config = {}) {
        this.config = {
            visualizerFFTSize: config.visualizerFFTSize || 256,
            crossfadeDuration: config.crossfadeDuration || 300,
            enableVisualization: config.enableVisualization !== false,
            ...config
        };
        
        // Audio state
        this.audioElement = null;
        this.audioContext = null;
        this.audioSource = null;
        this.analyser = null;
        this.gainNode = null;
        
        // Playback state
        this.isPlaying = false;
        this.isMuted = false;
        this.isShuffled = false;
        this.currentVolume = 1.0;
        this.currentTrack = null;
        this.currentIndex = 0;
        
        // Playlists
        this.playlists = new Map();
        this.currentPlaylist = 'ambient';
        this.currentTracks = [];
        
        // UI elements
        this.elements = {};
        
        // Event listeners
        this.eventListeners = new Set();
        
        // Media Session
        this.mediaSessionSupported = 'mediaSession' in navigator;
        
        // Initialization state
        this.isInitialized = false;
        this.isAudioContextInitialized = false;
    }
    
    async init() {
        try {
            // Find and store DOM elements
            this.findElements();
            
            // Load playlist data
            await this.loadPlaylists();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize audio context (requires user interaction)
            this.prepareAudioContext();
            
            // Setup Media Session API
            this.setupMediaSession();
            
            // Setup visualizer
            this.setupVisualizer();
            
            // Load initial playlist
            this.loadPlaylist(this.currentPlaylist);
            
            this.isInitialized = true;
            this.emit('initialized');
            
        } catch (error) {
            console.error('Failed to initialize audio player:', error);
            this.showError('Nie można zainicjalizować odtwarzacza audio');
            throw error;
        }
    }
    
    findElements() {
        const elementMap = {
            audioElement: '#radio-player',
            playPauseBtn: '#radio-play-pause-btn',
            nextBtn: '#radio-next-btn',
            prevBtn: '#radio-prev-btn',
            shuffleBtn: '#shuffle-btn',
            muteBtn: '#mute-btn',
            progressBar: '#progress-bar',
            progressFill: '#progress-fill',
            trackTitle: '#current-track-title',
            trackMeta: '#current-track-meta',
            categoryLabel: '#current-category',
            durationLabel: '#current-duration',
            visualizer: '#visualizer',
            playlist: '#playlist',
            categoryTabs: '.category-tab',
            autoplayOverlay: '#autoplay-overlay',
            fallbackMessage: '#audio-fallback'
        };
        
        for (const [key, selector] of Object.entries(elementMap)) {
            const element = document.querySelector(selector);
            if (!element && key === 'audioElement') {
                throw new Error(`Required element not found: ${selector}`);
            }
            this.elements[key] = element;
        }
        
        // Get category tabs as NodeList
        this.elements.categoryTabs = document.querySelectorAll('.category-tab');
    }
    
    async loadPlaylists() {
        try {
            const response = await fetch('data/playlist.json');
            if (!response.ok) {
                throw new Error(`Failed to load playlist: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Organize tracks by category
            if (data.tracks && Array.isArray(data.tracks)) {
                const categories = ['ambient', 'disco', 'hiphop', 'kids', 'barbara'];
                
                categories.forEach(category => {
                    const categoryTracks = data.tracks.filter(track => 
                        track.category === category
                    );
                    this.playlists.set(category, categoryTracks);
                });
                
                console.log(`Loaded playlists:`, 
                    Array.from(this.playlists.entries()).map(([cat, tracks]) => 
                        `${cat}: ${tracks.length} tracks`
                    ).join(', ')
                );
            } else {
                throw new Error('Invalid playlist format');
            }
            
        } catch (error) {
            console.warn('Failed to load playlists:', error);
            
            // Create fallback empty playlists
            ['ambient', 'disco', 'hiphop', 'kids'].forEach(category => {
                this.playlists.set(category, []);
            });
            
            this.showFallbackMessage();
        }
    }
    
    setupEventListeners() {
        // Audio element events
        if (this.elements.audioElement) {
            this.elements.audioElement.addEventListener('loadstart', () => this.onLoadStart());
            this.elements.audioElement.addEventListener('canplay', () => this.onCanPlay());
            this.elements.audioElement.addEventListener('play', () => this.onPlay());
            this.elements.audioElement.addEventListener('pause', () => this.onPause());
            this.elements.audioElement.addEventListener('ended', () => this.onEnded());
            this.elements.audioElement.addEventListener('error', (e) => this.onError(e));
            this.elements.audioElement.addEventListener('timeupdate', () => this.onTimeUpdate());
            this.elements.audioElement.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
        }
        
        // Control buttons
        if (this.elements.playPauseBtn) {
            this.elements.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        
        if (this.elements.nextBtn) {
            this.elements.nextBtn.addEventListener('click', () => this.next());
        }
        
        if (this.elements.prevBtn) {
            this.elements.prevBtn.addEventListener('click', () => this.prev());
        }
        
        if (this.elements.shuffleBtn) {
            this.elements.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        }
        
        if (this.elements.muteBtn) {
            this.elements.muteBtn.addEventListener('click', () => this.toggleMute());
        }
        
        // Progress bar
        if (this.elements.progressBar) {
            this.elements.progressBar.addEventListener('click', (e) => this.seek(e));
        }
        
        // Category tabs
        this.elements.categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.getAttribute('data-category');
                if (category) {
                    this.switchPlaylist(category);
                }
            });
        });
        
        // Autoplay overlay
        if (this.elements.autoplayOverlay) {
            const moodButtons = this.elements.autoplayOverlay.querySelectorAll('.mood-btn');
            moodButtons.forEach(btn => {
                btn.addEventListener('click', (e) => this.handleAutoplayPermission(e));
            });
        }
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when not typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePlayPause();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.next();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.prev();
                    break;
                case 'KeyM':
                    e.preventDefault();
                    this.toggleMute();
                    break;
                case 'KeyS':
                    e.preventDefault();
                    this.toggleShuffle();
                    break;
            }
        });
    }
    
    async prepareAudioContext() {
        // Audio context will be initialized on first user interaction
        this.isAudioContextInitialized = false;
    }
    
    async initializeAudioContext() {
        if (this.isAudioContextInitialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Create analyser for visualization
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.config.visualizerFFTSize;
            
            // Create gain node for volume control
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = this.currentVolume;
            
            // Connect audio element to Web Audio API
            if (this.elements.audioElement) {
                this.audioSource = this.audioContext.createMediaElementSource(this.elements.audioElement);
                this.audioSource
                    .connect(this.gainNode)
                    .connect(this.analyser)
                    .connect(this.audioContext.destination);
            }
            
            this.isAudioContextInitialized = true;
            this.enableControls();
            
            console.log('Web Audio API initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Web Audio API:', error);
            this.showError('Nie można zainicjalizować kontekstu audio');
        }
    }
    
    setupMediaSession() {
        if (!this.mediaSessionSupported) {
            console.log('Media Session API not supported');
            return;
        }
        
        navigator.mediaSession.setActionHandler('play', () => this.play());
        navigator.mediaSession.setActionHandler('pause', () => this.pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
        navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
        
        // Optional handlers
        if ('seekbackward' in navigator.mediaSession) {
            navigator.mediaSession.setActionHandler('seekbackward', () => this.seekRelative(-10));
        }
        
        if ('seekforward' in navigator.mediaSession) {
            navigator.mediaSession.setActionHandler('seekforward', () => this.seekRelative(10));
        }
    }
    
    updateMediaSession() {
        if (!this.mediaSessionSupported || !this.currentTrack) return;
        
        const metadata = {
            title: this.generateTitle(this.currentTrack.file),
            artist: 'Radio Adamowo',
            album: this.currentTrack.category || 'Unknown',
        };
        
        // Add artwork if available
        if (this.currentTrack.metadata && this.currentTrack.metadata.artwork) {
            metadata.artwork = [
                {
                    src: this.currentTrack.metadata.artwork,
                    sizes: '512x512',
                    type: 'image/png'
                }
            ];
        } else {
            // Use default artwork
            metadata.artwork = [
                {
                    src: 'images/placeholders/album-cover.png',
                    sizes: '512x512',
                    type: 'image/png'
                }
            ];
        }
        
        navigator.mediaSession.metadata = new MediaMetadata(metadata);
    }
    
    setupVisualizer() {
        if (!this.config.enableVisualization || !this.elements.visualizer) return;
        
        // Simple CSS-based visualizer
        this.startVisualizer();
    }
    
    startVisualizer() {
        if (!this.isPlaying || !this.elements.visualizer) return;
        
        const bars = this.elements.visualizer.querySelectorAll('.bar');
        
        const animate = () => {
            if (!this.isPlaying) return;
            
            bars.forEach((bar, index) => {
                const height = Math.random() * 16 + 4; // 4-20px
                bar.style.height = `${height}px`;
            });
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    // Playlist management
    loadPlaylist(category) {
        const tracks = this.playlists.get(category);
        if (!tracks) {
            console.warn(`Playlist not found: ${category}`);
            return;
        }
        
        this.currentPlaylist = category;
        this.currentTracks = [...tracks];
        this.currentIndex = 0;
        
        if (this.isShuffled) {
            this.shuffleArray(this.currentTracks);
        }
        
        this.updatePlaylistUI();
        this.updateCategoryTabs();
        
        // Load first track if available
        if (this.currentTracks.length > 0) {
            this.loadTrack(0);
        } else {
            this.showFallbackMessage();
        }
    }
    
    switchPlaylist(category) {
        if (category === this.currentPlaylist) return;
        
        // Stop current playback
        if (this.isPlaying) {
            this.pause();
        }
        
        this.loadPlaylist(category);
        
        // Track analytics
        this.emit('playlistChanged', { category, trackCount: this.currentTracks.length });
    }
    
    updatePlaylistUI() {
        if (!this.elements.playlist) return;
        
        const playlistHTML = this.currentTracks.map((track, index) => `
            <div class="track-item ${index === this.currentIndex ? 'active' : ''}" 
                 data-index="${index}"
                 role="button" 
                 tabindex="0"
                 aria-label="Play ${this.generateTitle(track.file)}">
                <div class="track-title">${this.generateTitle(track.file)}</div>
                <div class="track-info">
                    <span class="track-category">${track.category || 'Unknown'}</span>
                    <span class="track-duration">${track.metadata?.duration || '00:00'}</span>
                </div>
            </div>
        `).join('');
        
        this.elements.playlist.innerHTML = playlistHTML;
        
        // Add click handlers to track items
        this.elements.playlist.querySelectorAll('.track-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.getAttribute('data-index'));
                this.loadTrack(index);
                if (!this.isPlaying) {
                    this.play();
                }
            });
            
            // Keyboard support
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const index = parseInt(item.getAttribute('data-index'));
                    this.loadTrack(index);
                    if (!this.isPlaying) {
                        this.play();
                    }
                }
            });
        });
    }
    
    updateCategoryTabs() {
        this.elements.categoryTabs.forEach(tab => {
            const category = tab.getAttribute('data-category');
            const isActive = category === this.currentPlaylist;
            
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive);
        });
    }
    
    // Playback controls
    async togglePlayPause() {
        if (!this.isAudioContextInitialized) {
            this.showAutoplayOverlay();
            return;
        }
        
        if (this.isPlaying) {
            this.pause();
        } else {
            await this.play();
        }
    }
    
    async play() {
        if (!this.elements.audioElement || !this.currentTrack) {
            console.warn('Cannot play: no audio element or track');
            return;
        }
        
        try {
            await this.elements.audioElement.play();
        } catch (error) {
            console.error('Playback failed:', error);
            this.showError('Nie można odtworzyć utworu');
        }
    }
    
    pause() {
        if (this.elements.audioElement) {
            this.elements.audioElement.pause();
        }
    }
    
    next() {
        if (this.currentTracks.length === 0) return;
        
        let nextIndex = this.currentIndex + 1;
        if (nextIndex >= this.currentTracks.length) {
            nextIndex = 0; // Loop to beginning
        }
        
        this.loadTrack(nextIndex);
        
        if (this.isPlaying) {
            this.play();
        }
    }
    
    prev() {
        if (this.currentTracks.length === 0) return;
        
        let prevIndex = this.currentIndex - 1;
        if (prevIndex < 0) {
            prevIndex = this.currentTracks.length - 1; // Loop to end
        }
        
        this.loadTrack(prevIndex);
        
        if (this.isPlaying) {
            this.play();
        }
    }
    
    loadTrack(index) {
        if (index < 0 || index >= this.currentTracks.length) {
            console.warn(`Invalid track index: ${index}`);
            return;
        }
        
        const track = this.currentTracks[index];
        if (!track || !track.file) {
            console.warn('Invalid track data:', track);
            return;
        }
        
        this.currentIndex = index;
        this.currentTrack = track;
        
        // Update audio source
        if (this.elements.audioElement) {
            this.elements.audioElement.src = track.file;
        }
        
        // Update UI
        this.updateTrackDisplay();
        this.updateMediaSession();
        this.updatePlaylistUI();
        
        this.emit('trackChanged', { track, index });
    }
    
    seek(event) {
        if (!this.elements.audioElement || !this.elements.progressBar) return;
        
        const rect = this.elements.progressBar.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        const newTime = percent * this.elements.audioElement.duration;
        
        if (!isNaN(newTime)) {
            this.elements.audioElement.currentTime = newTime;
        }
    }
    
    seekRelative(seconds) {
        if (!this.elements.audioElement) return;
        
        const newTime = this.elements.audioElement.currentTime + seconds;
        const clampedTime = Math.max(0, Math.min(newTime, this.elements.audioElement.duration));
        
        this.elements.audioElement.currentTime = clampedTime;
    }
    
    toggleShuffle() {
        this.isShuffled = !this.isShuffled;
        
        if (this.elements.shuffleBtn) {
            this.elements.shuffleBtn.setAttribute('aria-pressed', this.isShuffled);
            this.elements.shuffleBtn.classList.toggle('active', this.isShuffled);
        }
        
        // Re-shuffle current playlist
        if (this.isShuffled) {
            const currentTrack = this.currentTrack;
            this.shuffleArray(this.currentTracks);
            
            // Find new index of current track
            if (currentTrack) {
                this.currentIndex = this.currentTracks.findIndex(track => track === currentTrack);
                if (this.currentIndex === -1) this.currentIndex = 0;
            }
        } else {
            // Restore original order
            this.loadPlaylist(this.currentPlaylist);
        }
        
        this.updatePlaylistUI();
        this.emit('shuffleToggled', { enabled: this.isShuffled });
    }
    
    toggleMute() {
        this.isMuted = !this.isMuted;
        
        if (this.gainNode) {
            this.gainNode.gain.value = this.isMuted ? 0 : this.currentVolume;
        } else if (this.elements.audioElement) {
            this.elements.audioElement.muted = this.isMuted;
        }
        
        this.updateMuteButton();
        this.emit('muteToggled', { muted: this.isMuted });
    }
    
    setVolume(volume) {
        this.currentVolume = Math.max(0, Math.min(1, volume));
        
        if (this.gainNode && !this.isMuted) {
            this.gainNode.gain.value = this.currentVolume;
        } else if (this.elements.audioElement) {
            this.elements.audioElement.volume = this.currentVolume;
        }
    }
    
    // Audio event handlers
    onLoadStart() {
        this.setLoadingState(true);
    }
    
    onCanPlay() {
        this.setLoadingState(false);
        this.enableControls();
    }
    
    onPlay() {
        this.isPlaying = true;
        this.updatePlayButton();
        this.startVisualizer();
        this.emit('play');
    }
    
    onPause() {
        this.isPlaying = false;
        this.updatePlayButton();
        this.emit('pause');
    }
    
    onEnded() {
        this.isPlaying = false;
        this.updatePlayButton();
        
        // Auto-play next track
        this.next();
        if (this.currentTracks.length > 0) {
            this.play();
        }
        
        this.emit('ended');
    }
    
    onError(event) {
        console.error('Audio error:', event);
        this.showError('Błąd podczas odtwarzania utworu');
        this.isPlaying = false;
        this.updatePlayButton();
        this.setLoadingState(false);
        this.emit('error', { error: event });
    }
    
    onTimeUpdate() {
        this.updateProgress();
    }
    
    onLoadedMetadata() {
        this.updateTrackDisplay();
    }
    
    // UI updates
    updatePlayButton() {
        if (!this.elements.playPauseBtn) return;
        
        const playIcon = this.elements.playPauseBtn.querySelector('.play-icon');
        const pauseIcon = this.elements.playPauseBtn.querySelector('.pause-icon');
        
        if (playIcon && pauseIcon) {
            if (this.isPlaying) {
                playIcon.classList.add('hidden');
                pauseIcon.classList.remove('hidden');
            } else {
                playIcon.classList.remove('hidden');
                pauseIcon.classList.add('hidden');
            }
        }
        
        const label = this.isPlaying ? 'Pause' : 'Play';
        this.elements.playPauseBtn.setAttribute('aria-label', label);
    }
    
    updateMuteButton() {
        if (!this.elements.muteBtn) return;
        
        const volumeOn = this.elements.muteBtn.querySelector('.volume-on');
        const volumeOff = this.elements.muteBtn.querySelector('.volume-off');
        
        if (volumeOn && volumeOff) {
            if (this.isMuted) {
                volumeOn.classList.add('hidden');
                volumeOff.classList.remove('hidden');
            } else {
                volumeOn.classList.remove('hidden');
                volumeOff.classList.add('hidden');
            }
        }
        
        this.elements.muteBtn.setAttribute('aria-pressed', this.isMuted);
    }
    
    updateProgress() {
        if (!this.elements.audioElement || !this.elements.progressFill || !this.elements.progressBar) return;
        
        const { currentTime, duration } = this.elements.audioElement;
        
        if (duration > 0) {
            const percent = (currentTime / duration) * 100;
            this.elements.progressFill.style.width = `${percent}%`;
            this.elements.progressBar.setAttribute('aria-valuenow', percent);
        }
    }
    
    updateTrackDisplay() {
        if (!this.currentTrack) return;
        
        // Update title
        if (this.elements.trackTitle) {
            this.elements.trackTitle.textContent = this.generateTitle(this.currentTrack.file);
        }
        
        // Update category
        if (this.elements.categoryLabel) {
            this.elements.categoryLabel.textContent = this.currentTrack.category || 'Unknown';
        }
        
        // Update duration
        if (this.elements.durationLabel && this.elements.audioElement) {
            const duration = this.elements.audioElement.duration;
            if (!isNaN(duration)) {
                this.elements.durationLabel.textContent = this.formatTime(duration);
            } else if (this.currentTrack.metadata && this.currentTrack.metadata.duration) {
                this.elements.durationLabel.textContent = this.currentTrack.metadata.duration;
            }
        }
    }
    
    enableControls() {
        const controls = [
            this.elements.playPauseBtn,
            this.elements.nextBtn,
            this.elements.prevBtn,
            this.elements.shuffleBtn,
            this.elements.muteBtn
        ];
        
        controls.forEach(control => {
            if (control) {
                control.disabled = false;
            }
        });
    }
    
    setLoadingState(loading) {
        const container = document.querySelector('.player-container');
        if (container) {
            container.classList.toggle('loading', loading);
        }
    }
    
    showAutoplayOverlay() {
        if (this.elements.autoplayOverlay) {
            this.elements.autoplayOverlay.classList.remove('hidden');
        }
    }
    
    hideAutoplayOverlay() {
        if (this.elements.autoplayOverlay) {
            this.elements.autoplayOverlay.classList.add('hidden');
        }
    }
    
    showFallbackMessage() {
        if (this.elements.fallbackMessage) {
            this.elements.fallbackMessage.classList.remove('hidden');
        }
    }
    
    handleAutoplayPermission(event) {
        const mood = event.target.closest('.mood-btn').getAttribute('data-mood');
        
        // Initialize audio context
        this.initializeAudioContext().then(() => {
            this.hideAutoplayOverlay();
            
            // Start playback
            if (this.currentTracks.length > 0) {
                this.play();
            }
            
            this.emit('autoplayPermissionGranted', { mood });
        }).catch(error => {
            console.error('Failed to initialize audio context:', error);
            this.showError('Nie można zainicjalizować audio');
        });
    }
    
    // Utility methods
    generateTitle(filepath) {
        if (!filepath || typeof filepath !== 'string') return 'Unknown Track';
        
        const filename = filepath.split('/').pop();
        if (!filename) return 'Unknown Track';
        
        let title = filename.replace(/\\.mp3$/i, '');
        title = title.replace(/Utwor\\s*\\((\\d+)\\)/i, 'Utwór $1');
        title = title.replace(/_/g, ' ');
        title = title.replace(/\\b\\w/g, l => l.toUpperCase());
        
        return title || 'Unknown Track';
    }
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    showError(message) {
        // Emit error event for external handling
        this.emit('error', { message });
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
                    console.error('Error in audio player event listener:', error);
                }
            }
        });
    }
    
    // Public API
    getCurrentTrack() {
        return this.currentTrack;
    }
    
    getCurrentPlaylist() {
        return this.currentPlaylist;
    }
    
    getAvailablePlaylists() {
        return Array.from(this.playlists.keys());
    }
    
    getPlaybackState() {
        return {
            isPlaying: this.isPlaying,
            isMuted: this.isMuted,
            isShuffled: this.isShuffled,
            currentVolume: this.currentVolume,
            currentTrack: this.currentTrack,
            currentPlaylist: this.currentPlaylist,
            currentIndex: this.currentIndex
        };
    }
}

export default AudioPlayer;