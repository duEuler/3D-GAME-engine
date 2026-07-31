import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js';

import { firebaseConfig } from './config.mjs';

/** @type {import('firebase/app').FirebaseApp} */
export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
