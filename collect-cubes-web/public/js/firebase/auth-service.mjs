import { getApp } from './core.mjs';
import { withTimeout } from './with-timeout.mjs';

/** @type {import('firebase/auth').Auth | null} */
let auth = null;

/** @type {import('firebase/auth').User | null} */
let currentUser = null;

/** @type {((user: import('firebase/auth').User | null) => void)[]} */
const listeners = [];

/** @type {Promise<import('firebase/auth').Auth> | null} */
let authInitPromise = null;

const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth < 900);

/**
 * @returns {Promise<import('firebase/auth').Auth>}
 */
async function getAuthClient() {
    if (auth) return auth;

    if (!authInitPromise) {
        authInitPromise = (async () => {
            const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js');
            auth = getAuth(await getApp());
            onAuthStateChanged(auth, (user) => {
                currentUser = user;
                listeners.forEach((listener) => listener(user));
            });
            return auth;
        })();
    }

    return authInitPromise;
}

const googleProvider = { provider: null };

/**
 * @returns {Promise<import('firebase/auth').GoogleAuthProvider>}
 */
async function getGoogleProvider() {
    if (!googleProvider.provider) {
        const { GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js');
        googleProvider.provider = new GoogleAuthProvider();
    }
    return googleProvider.provider;
}

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

/**
 * Completes Google redirect sign-in when returning to the app.
 * @returns {Promise<import('firebase/auth').UserCredential | null>}
 */
export async function completeGoogleRedirectIfNeeded() {
    const { getRedirectResult } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js');
    return getRedirectResult(await getAuthClient());
}

/**
 * @returns {Promise<import('firebase/auth').UserCredential | void>} Google sign-in result.
 */
export async function signInWithGoogle() {
    const authClient = await getAuthClient();
    const provider = await getGoogleProvider();
    const { signInWithPopup, signInWithRedirect } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js');

    try {
        if (IS_MOBILE) {
            await signInWithRedirect(authClient, provider);
            return;
        }
        return await signInWithPopup(authClient, provider);
    } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
        if (code === 'auth/unauthorized-domain') {
            throw new Error(
                `Domínio não autorizado no Firebase (${location.hostname}). ` +
                'Use "Jogar como convidado" ou peça para autorizar o domínio no console Firebase.'
            );
        }
        if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
            await signInWithRedirect(authClient, provider);
            return;
        }
        throw error;
    }
}

/**
 * @returns {Promise<import('firebase/auth').UserCredential>} Guest sign-in result.
 */
export async function signInAsGuest() {
    const { signInAnonymously } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js');
    return signInAnonymously(await getAuthClient());
}

/** @returns {Promise<void>} */
export async function signOutUser() {
    const { signOut } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js');
    return signOut(await getAuthClient());
}

/** @returns {import('firebase/auth').User | null} */
export function getCurrentUser() {
    return currentUser;
}

/**
 * @param {number} [timeoutMs=25000] - Auth timeout.
 * @returns {Promise<import('firebase/auth').User>} Ensures a signed-in user.
 */
export async function ensureSignedIn(timeoutMs = 25000) {
    if (currentUser) {
        return currentUser;
    }

    await getAuthClient();
    const result = await withTimeout(signInAsGuest(), timeoutMs, 'Autenticação convidado');
    return result.user;
}
