// "Continue with Google" for referral partners, using Firebase Authentication.
// Exposes window.AUR_GOOGLE.signIn() → Promise<{ idToken, email, name }> and signOut().
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const app = initializeApp(window.AUR_REFERRAL.FIREBASE);
const auth = getAuth(app);

window.AUR_GOOGLE = {
  async signIn() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    return {
      idToken: await result.user.getIdToken(),
      email: result.user.email || '',
      name: result.user.displayName || ''
    };
  },
  signOut() { return signOut(auth).catch(() => {}); }
};
document.dispatchEvent(new Event('aur-google-ready'));
