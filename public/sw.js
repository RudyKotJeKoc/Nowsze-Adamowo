/**
 * Radio Adamowo - Service Worker
 * Implements caching strategies for PWA offline functionality
 */

const CACHE_NAME = 'radio-adamowo-v1';
const CACHE_VERSION = '1.0.0';

// Assets to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/manifest.json',
    '/lang/pl.json',
    '/lang/en.json',
    '/lang/nl.json',
    '/data/playlist.json'
];

// Assets to cache on demand
const DYNAMIC_ASSETS_PATTERNS = [
    /^\/images\/.+/,
    /^\/audio\/.+/,
    /^\/music\/.+/,
    /^\/lang\/.+\.json$/,
    /^\/data\/.+\.json$/
];

// Cache strategies
const CACHE_STRATEGIES = {
    CACHE_FIRST: 'cache-first',
    NETWORK_FIRST: 'network-first',
    STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
    NETWORK_ONLY: 'network-only',
    CACHE_ONLY: 'cache-only'
};

// Route configurations
const ROUTE_CONFIGS = [
    {
        pattern: /^\/$/,
        strategy: CACHE_STRATEGIES.NETWORK_FIRST
    },
    {
        pattern: /\.(js|css)$/,
        strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE
    },
    {
        pattern: /\.(png|jpg|jpeg|gif|svg|ico)$/,
        strategy: CACHE_STRATEGIES.CACHE_FIRST
    },
    {
        pattern: /\.(mp3|wav|ogg)$/,
        strategy: CACHE_STRATEGIES.CACHE_FIRST
    },
    {
        pattern: /\.json$/,
        strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE
    },
    {
        pattern: /^\/api\//,
        strategy: CACHE_STRATEGIES.NETWORK_ONLY
    }
];

// Maximum cache sizes
const CACHE_LIMITS = {
    images: 50, // max 50 images
    audio: 20,  // max 20 audio files
    data: 10    // max 10 data files
};

// Cache duration (in milliseconds)
const CACHE_DURATION = {
    images: 7 * 24 * 60 * 60 * 1000,  // 7 days
    audio: 30 * 24 * 60 * 60 * 1000,  // 30 days
    data: 24 * 60 * 60 * 1000,        // 1 day
    static: 7 * 24 * 60 * 60 * 1000   // 7 days
};

// Install Event - Cache static assets
self.addEventListener('install', (event) => {
    console.log(`SW Install: Caching static assets for ${CACHE_NAME}`);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(STATIC_ASSETS.map(url => {
                    // Handle root path
                    if (url === '/') {
                        return new Request('/', { headers: { 'cache-bust': Date.now() } });
                    }
                    return url;
                }));
            })
            .then(() => {
                console.log('SW Install: Static assets cached successfully');
                return self.skipWaiting(); // Activate immediately
            })
            .catch(error => {
                console.error('SW Install: Failed to cache static assets:', error);
            })
    );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
    console.log(`SW Activate: Cleaning up old caches for ${CACHE_NAME}`);
    
    event.waitUntil(
        Promise.all([
            // Clean old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME && cacheName.startsWith('radio-adamowo-')) {
                            console.log(`SW Activate: Deleting old cache ${cacheName}`);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Enforce cache size limits
            enforceQuotaLimits(),
            // Take control of all clients
            self.clients.claim()
        ])
        .then(() => {
            console.log('SW Activate: Activation complete');
        })
        .catch(error => {
            console.error('SW Activate: Activation failed:', error);
        })
    );
});

// Fetch Event - Implement caching strategies
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Only handle http/https requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Skip POST requests and other non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Find matching route configuration
    const routeConfig = findRouteConfig(url.pathname);
    const strategy = routeConfig ? routeConfig.strategy : CACHE_STRATEGIES.NETWORK_FIRST;
    
    event.respondWith(
        handleRequest(request, strategy)
            .catch(error => {
                console.error('SW Fetch: Request handling failed:', error);
                return createErrorResponse();
            })
    );
});

// Background Sync - Handle offline actions
self.addEventListener('sync', (event) => {
    console.log('SW Sync: Background sync triggered:', event.tag);
    
    if (event.tag === 'background-playlist-update') {
        event.waitUntil(updatePlaylistCache());
    }
    
    if (event.tag === 'background-analytics') {
        event.waitUntil(syncAnalyticsData());
    }
});

// Message handling - Communication with main thread
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_CACHE_STATUS':
            event.ports[0].postMessage({
                cacheSize: getCacheSize(),
                cacheVersion: CACHE_VERSION
            });
            break;
            
        case 'CLEAR_CACHE':
            clearCache(data.cacheType).then(() => {
                event.ports[0].postMessage({ success: true });
            });
            break;
            
        case 'PRELOAD_AUDIO':
            preloadAudio(data.urls).then(() => {
                event.ports[0].postMessage({ success: true });
            });
            break;
            
        default:
            console.log('SW Message: Unknown message type:', type);
    }
});

// Caching strategy implementations
async function handleRequest(request, strategy) {
    switch (strategy) {
        case CACHE_STRATEGIES.CACHE_FIRST:
            return cacheFirst(request);
            
        case CACHE_STRATEGIES.NETWORK_FIRST:
            return networkFirst(request);
            
        case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
            return staleWhileRevalidate(request);
            
        case CACHE_STRATEGIES.CACHE_ONLY:
            return cacheOnly(request);
            
        case CACHE_STRATEGIES.NETWORK_ONLY:
            return networkOnly(request);
            
        default:
            return networkFirst(request);
    }
}

async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, request.url)) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            await cacheResponse(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        if (cachedResponse) {
            return cachedResponse; // Return stale cache if network fails
        }
        throw error;
    }
}

async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            await cacheResponse(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

async function staleWhileRevalidate(request) {
    const cachedResponse = await caches.match(request);
    
    // Start network request immediately
    const networkResponsePromise = fetch(request)
        .then(response => {
            if (response.ok) {
                cacheResponse(request, response.clone());
            }
            return response;
        })
        .catch(error => {
            console.log('SW: Network request failed:', error.message);
            return null;
        });
    
    // Return cache immediately if available, otherwise wait for network
    if (cachedResponse && !isExpired(cachedResponse, request.url)) {
        // Update cache in background
        networkResponsePromise.catch(() => {}); // Ignore errors
        return cachedResponse;
    }
    
    return networkResponsePromise.then(response => {
        if (response) {
            return response;
        }
        if (cachedResponse) {
            return cachedResponse; // Return stale cache if network fails
        }
        throw new Error('No cached response and network failed');
    });
}

async function cacheOnly(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    throw new Error('No cached response available');
}

async function networkOnly(request) {
    return fetch(request);
}

// Cache management functions
async function cacheResponse(request, response) {
    if (!shouldCache(response)) {
        return;
    }
    
    const cache = await caches.open(CACHE_NAME);
    
    // Add timestamp for expiration checking
    const responseWithTimestamp = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
            ...response.headers,
            'sw-cached-at': Date.now()
        }
    });
    
    await cache.put(request, responseWithTimestamp);
}

function shouldCache(response) {
    // Don't cache error responses
    if (!response.ok) {
        return false;
    }
    
    // Don't cache opaque responses (CORS)
    if (response.type === 'opaque') {
        return false;
    }
    
    // Don't cache very large responses
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
        return false;
    }
    
    return true;
}

function isExpired(response, url) {
    const cachedAt = response.headers.get('sw-cached-at');
    if (!cachedAt) {
        return false; // No timestamp, assume not expired
    }
    
    const cacheTime = parseInt(cachedAt);
    const now = Date.now();
    const maxAge = getCacheMaxAge(url);
    
    return (now - cacheTime) > maxAge;
}

function getCacheMaxAge(url) {
    if (url.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) {
        return CACHE_DURATION.images;
    }
    if (url.match(/\.(mp3|wav|ogg)$/)) {
        return CACHE_DURATION.audio;
    }
    if (url.match(/\.json$/)) {
        return CACHE_DURATION.data;
    }
    return CACHE_DURATION.static;
}

function findRouteConfig(pathname) {
    return ROUTE_CONFIGS.find(config => config.pattern.test(pathname));
}

async function enforceQuotaLimits() {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    // Group requests by type
    const grouped = {
        images: [],
        audio: [],
        data: [],
        other: []
    };
    
    requests.forEach(request => {
        const url = request.url;
        if (url.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) {
            grouped.images.push(request);
        } else if (url.match(/\.(mp3|wav|ogg)$/)) {
            grouped.audio.push(request);
        } else if (url.match(/\.json$/)) {
            grouped.data.push(request);
        } else {
            grouped.other.push(request);
        }
    });
    
    // Enforce limits for each type
    for (const [type, requests] of Object.entries(grouped)) {
        const limit = CACHE_LIMITS[type];
        if (limit && requests.length > limit) {
            // Sort by last access time (if available) or URL
            requests.sort((a, b) => a.url.localeCompare(b.url));
            
            // Remove oldest entries
            const toRemove = requests.slice(0, requests.length - limit);
            await Promise.all(toRemove.map(request => cache.delete(request)));
            
            console.log(`SW: Removed ${toRemove.length} old ${type} entries from cache`);
        }
    }
}

async function updatePlaylistCache() {
    try {
        const playlistResponse = await fetch('/data/playlist.json');
        if (playlistResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put('/data/playlist.json', playlistResponse);
            console.log('SW: Playlist cache updated');
        }
    } catch (error) {
        console.error('SW: Failed to update playlist cache:', error);
    }
}

async function syncAnalyticsData() {
    // Placeholder for analytics sync
    console.log('SW: Analytics sync triggered');
    
    // In a real implementation, this would:
    // 1. Read queued analytics events from IndexedDB
    // 2. Send them to analytics server
    // 3. Clear the queue on success
}

async function preloadAudio(urls) {
    if (!Array.isArray(urls)) return;
    
    const cache = await caches.open(CACHE_NAME);
    const preloadPromises = urls.map(async url => {
        try {
            const response = await fetch(url);
            if (response.ok) {
                await cache.put(url, response);
                console.log(`SW: Preloaded audio: ${url}`);
            }
        } catch (error) {
            console.error(`SW: Failed to preload audio ${url}:`, error);
        }
    });
    
    await Promise.all(preloadPromises);
}

async function getCacheSize() {
    try {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage,
                quota: estimate.quota,
                usagePercent: ((estimate.usage / estimate.quota) * 100).toFixed(2)
            };
        }
    } catch (error) {
        console.error('SW: Failed to get cache size:', error);
    }
    
    return null;
}

async function clearCache(cacheType = 'all') {
    try {
        if (cacheType === 'all') {
            await caches.delete(CACHE_NAME);
            console.log('SW: All caches cleared');
        } else {
            const cache = await caches.open(CACHE_NAME);
            const requests = await cache.keys();
            
            const toDelete = requests.filter(request => {
                const url = request.url;
                switch (cacheType) {
                    case 'images':
                        return url.match(/\.(png|jpg|jpeg|gif|svg|ico)$/);
                    case 'audio':
                        return url.match(/\.(mp3|wav|ogg)$/);
                    case 'data':
                        return url.match(/\.json$/);
                    default:
                        return false;
                }
            });
            
            await Promise.all(toDelete.map(request => cache.delete(request)));
            console.log(`SW: Cleared ${toDelete.length} ${cacheType} cache entries`);
        }
    } catch (error) {
        console.error('SW: Failed to clear cache:', error);
        throw error;
    }
}

function createErrorResponse() {
    return new Response(
        JSON.stringify({
            error: 'Network error occurred',
            message: 'Please check your internet connection',
            offline: true
        }),
        {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );
}

// Debug logging
self.addEventListener('error', (event) => {
    console.error('SW Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('SW Unhandled Promise Rejection:', event.reason);
});

// Log service worker lifecycle
console.log(`SW: Radio Adamowo Service Worker ${CACHE_VERSION} loaded`);

// Export for testing (if in test environment)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CACHE_NAME,
        CACHE_STRATEGIES,
        handleRequest,
        cacheFirst,
        networkFirst,
        staleWhileRevalidate,
        shouldCache,
        isExpired
    };
}