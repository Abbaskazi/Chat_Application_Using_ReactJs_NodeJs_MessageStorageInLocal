// Notification service using Service Worker for background notifications

let serviceWorkerRegistration = null;

// Register Service Worker
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      serviceWorkerRegistration = registration;
      console.log('Service Worker registered successfully');
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return Notification.permission === 'granted';
};

// ❌ DO NOT show notifications from frontend (removed)
// Notifications should ONLY come from backend push
export const showNotification = async () => {
  console.log('❌ Frontend showNotification() disabled. Backend push only.');
  return;
};

// Subscribe to push notifications
export const subscribeToPush = async (username) => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push messaging is not supported');
    return null;
  }

  try {
    // Get VAPID public key from backend
    const response = await fetch('https://chat-backend-56f1.onrender.com/api/vapid-public-key');
    const { publicKey } = await response.json();

    if (!publicKey) {
      console.warn('VAPID key not configured on server');
      return null;
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Check subscription
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    // Save subscription to backend
    await fetch('https://chat-backend-56f1.onrender.com/api/push-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        subscription: subscription.toJSON()
      })
    });

    console.log('Push subscription successful');
    return subscription;

  } catch (error) {
    console.error('Error subscribing to push:', error);
    return null;
  }
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// Initialize notification service
export const initNotificationService = async (username) => {
  const registration = await registerServiceWorker();
  const hasPermission = await requestNotificationPermission();

  if (hasPermission && registration && username) {
    await subscribeToPush(username);
  }

  return registration;
};
