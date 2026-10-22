// Push notifications for referral partners (Firebase Cloud Messaging).
// Exposes window.AUR_PUSH: supported(), enable() → Promise<fcmToken>.
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getMessaging, getToken, isSupported } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js';

const cfg = window.AUR_REFERRAL.FIREBASE;
const app = getApps().length ? getApps()[0] : initializeApp(cfg);

window.AUR_PUSH = {
  async supported() {
    return !!window.AUR_REFERRAL.PUSH_NOTIFICATIONS && 'Notification' in window && 'serviceWorker' in navigator && !!cfg.vapidKey && (await isSupported());
  },
  async enable() {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw Object.assign(new Error('blocked'), { code: 'blocked' });
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return getToken(getMessaging(app), { vapidKey: cfg.vapidKey, serviceWorkerRegistration: registration });
  }
};
document.dispatchEvent(new Event('aur-push-ready'));
