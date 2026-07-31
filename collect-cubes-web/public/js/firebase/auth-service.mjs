import {
    GoogleAuthProvider,
    onAuthStateChanged,
    signInAnonymously,
    signInWithPopup,
    signOut
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

import { auth } from './app.mjs';

const googleProvider = new GoogleAuthProvider();

/** @type {import('firebase/auth').User | null} */
let currentUser = null;

/** @type {((user: import('firebase/auth').User | null) => void)[]} */
const listeners = [];

/**
 * @param {(user: import('firebase/auth').User | null) => void} callback - Auth listener.
 * @returns {() => void} Unsubscribe function.
 */
export function onUserChanged(callback) {
    listeners.push(callback);
    callback(currentUser);
    return () => {
        const index = listeners.indexOf(callback);
        if (index >= 0) listeners.splice(index, 1);
    };
}

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    listeners.forEach((listener) => listener(user));
});

/**
 * @returns {Promise<import('firebase/auth').UserCredential>} Google sign-in result.
 */
export function signInWithGoogle() {
    return signInWithPopup(auth, googleProvider);
}

/**
 * @returns {Promise<import('firebase/auth').UserCredential>} Guest sign-in result.
 */
export function signInAsGuest() {
    return signInAnonymously(auth);
}

/** @returns {Promise<void>} */
export function signOutUser() {
    return signOut(auth);
}

/** @returns {import('firebase/auth').User | null} */
export function getCurrentUser() {
    return currentUser;
}

/**
 * @returns {Promise<import('firebase/auth').User>} Ensures a signed-in user.
 */
export async function ensureSignedIn() {
    if (currentUser) {
        return currentUser;
    }
    const result = await signInAsGuest();
    return result.user;
}
