// AI Story Builder Service Worker
const CACHE_NAME = 'ai-story-builder-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// インストール時の処理
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('キャッシュを開きました');
        return cache.addAll(urlsToCache);
      })
  );
});

// フェッチ時の処理
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュがある場合はそれを返す
        if (response) {
          return response;
        }
        
        // ネットワークリクエストを実行
        return fetch(event.request).then((response) => {
          // 有効なレスポンスかチェック
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // レスポンスをクローン
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
  );
});

// アクティベート時の処理
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('古いキャッシュを削除します:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// プッシュ通知の処理
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : '新しい通知があります',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'アプリを開く',
        icon: '/icon-192x192.png'
      },
      {
        action: 'close',
        title: '閉じる',
        icon: '/icon-192x192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('AI Story Builder', options)
  );
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
