// Script to generate VAPID keys for web push
import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('VAPID Keys Generated:');
console.log('PUBLIC_VAPID_KEY:', vapidKeys.publicKey);
console.log('PRIVATE_VAPID_KEY:', vapidKeys.privateKey);
console.log('\nAdd these to your .env file or environment variables:');
console.log(`PUBLIC_VAPID_KEY=${vapidKeys.publicKey}`);
console.log(`PRIVATE_VAPID_KEY=${vapidKeys.privateKey}`);

