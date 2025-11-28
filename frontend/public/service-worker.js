// Service Worker for background notifications
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Handle push notifications from server
self.addEventListener('push', (event) => {
  console.log('Push received');
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 1️⃣ If NO clients → user is truly OFFLINE → show notification
        if (clientList.length === 0) {
          console.log('🔔 User OFFLINE → show notification');
          return showNotif(event);
        }

        // 2️⃣ Check if ANY client is active or visible
        let isActive = false;
        clientList.forEach((client) => {
          // Chrome / Firefox - use visibilityState
          if (client.visibilityState === 'visible') {
            isActive = true;
          }
          // Edge (fallback) - check focused property
          if (client.focused) {
            isActive = true;
          }
        });

        // 3️⃣ If user is NOT active → show notification
        if (!isActive) {
          console.log('🔔 User NOT active (background) → show notification');
          return showNotif(event);
        }

        // 4️⃣ User active → block notification
        console.log('🔕 User ONLINE and ACTIVE → block notification');
      })
  );
});

function showNotif(event) {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { message: event.data.text() };
  }

  const title = `${data.username} sent a message`;
  const options = {
    body: data.message,
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: `chat-${Date.now()}`,
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      username: data.username,
      message: data.message
    }
  };

  console.log(`🔔 Notification SENT to user: "${data.username} sent a message"`);
  console.log(`📝 Message: "${data.message}"`);
  
  return self.registration.showNotification(title, options)
    .then(() => {
      console.log('✅ Notification displayed successfully');
    })
    .catch((error) => {
      console.error('❌ Error displaying notification:', error);
    });
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { username, message } = event.data;
    const title = `${username} sent a message`;
    
    console.log(`🔔 Notification SENT to user: "${title}"`);
    console.log(`📝 Message: "${message}"`);
    
    self.registration.showNotification(title, {
      body: message,
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: `chat-${Date.now()}`,
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200],
      data: {
        url: '/',
        username: username,
        message: message
      }
    })
    .then(() => {
      console.log('✅ Notification displayed successfully');
    })
    .catch(err => {
      console.error('❌ Error showing notification:', err);
    });
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then((clientList) => {
      // If a window is already open, focus it
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

