const CACHE_NAME = 'app-estadias-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './img/icon-192.png',
    './img/icon-512x512.png'
];

// Evento de Instalación
self.addEventListener('install', (event) => {
    console.log('Service Worker: Instalado');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Guardando archivos en caché');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Evento de Activación
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activado');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Borrando caché antigua');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Evento Fetch: Intercepta las peticiones de red
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

// Escuchar notificaciones Push
self.addEventListener('push', function(e) {
    if (!(self.Notification && self.Notification.permission === 'granted')) {
        return;
    }
    
    const data = e.data ? e.data.json() : { title: 'Notificación', body: 'Nuevo mensaje' };
    
    const options = {
        body: data.body,
        icon: './img/icon-192.png', // Usa tu icono
        badge: './img/icon-192.png'
    };
    
    e.waitUntil(self.registration.showNotification(data.title, options));
});

// Al dar clic en la notificación, abrir la app
self.addEventListener('notificationclick', function(e) {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url.includes('modulo-1.html') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('./modulo-1.html');
            }
        })
    );
});