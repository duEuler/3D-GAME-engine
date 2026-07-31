import { firebaseConfig } from './config.mjs';

/** @type {import('firebase/app').FirebaseApp | null} */
let app = null;

/**
 * @returns {Promise<import('firebase/app').FirebaseApp>}
 */
export async function getApp() {
    if (!app) {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js');
        app = initializeApp(firebaseConfig);
    }
    return app;
}
