import { getApp } from './core.mjs';
import { getCurrentUser } from './auth-service.mjs';

/** @type {import('firebase/database').Database | null} */
let rtdb = null;

/** @type {Promise<import('firebase/database').Database> | null} */
let rtdbInitPromise = null;

/**
 * @returns {Promise<import('firebase/database').Database>}
 */
async function getRtdb() {
    if (rtdb) return rtdb;

    if (!rtdbInitPromise) {
        rtdbInitPromise = (async () => {
            const { getDatabase } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
            rtdb = getDatabase(await getApp());
            return rtdb;
        })();
    }

    return rtdbInitPromise;
}

/**
 * @param {string} levelId - Level identifier.
 * @param {number} score - Score to publish.
 * @param {string} displayName - Player display name.
 * @returns {Promise<void>}
 */
export async function publishLiveScore(levelId, score, displayName) {
    const user = getCurrentUser();
    if (!user) {
        return;
    }

    const {
        get,
        ref,
        serverTimestamp,
        set
    } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();
    const scoreRef = ref(database, `collectCubes/leaderboards/${levelId}/scores/${user.uid}`);
    const currentSnap = await get(scoreRef);
    const currentScore = currentSnap.exists() ? currentSnap.val().score ?? 0 : 0;
    if (score < currentScore) {
        return;
    }

    await set(scoreRef, {
        score,
        displayName,
        updatedAt: serverTimestamp()
    });
}

/**
 * @param {string} levelId - Level identifier.
 * @param {(entries: Array<{uid: string, score: number, displayName: string}>) => void} callback - Listener.
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeLiveLeaderboard(levelId, callback) {
    let unsubscribe = () => {};

    getRtdb().then(async (database) => {
        const { onValue, ref } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
        const leaderboardRef = ref(database, `collectCubes/leaderboards/${levelId}/scores`);
        unsubscribe = onValue(leaderboardRef, (snapshot) => {
            const value = snapshot.val() || {};
            const entries = Object.entries(value)
                .map(([uid, data]) => ({
                    uid,
                    score: data.score ?? 0,
                    displayName: data.displayName ?? 'Jogador'
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);
            callback(entries);
        });
    });

    return () => unsubscribe();
}

/**
 * @returns {Promise<() => void>} Presence cleanup function.
 */
export async function registerPresence() {
    const user = getCurrentUser();
    if (!user) {
        return () => {};
    }

    const {
        onDisconnect,
        ref,
        serverTimestamp,
        set
    } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();
    const presenceRef = ref(database, `collectCubes/presence/${user.uid}`);
    await set(presenceRef, serverTimestamp());
    await onDisconnect(presenceRef).remove();

    return () => set(presenceRef, null);
}

/**
 * @param {(count: number) => void} callback - Online count listener.
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeOnlineCount(callback) {
    let unsubscribe = () => {};

    getRtdb().then(async (database) => {
        const { onValue, ref } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
        const presenceRef = ref(database, 'collectCubes/presence');
        unsubscribe = onValue(presenceRef, (snapshot) => {
            callback(snapshot.exists() ? Object.keys(snapshot.val()).length : 0);
        });
    });

    return () => unsubscribe();
}
