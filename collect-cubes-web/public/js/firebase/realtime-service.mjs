import {
    get,
    onDisconnect,
    onValue,
    ref,
    serverTimestamp,
    set
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js';

import { rtdb } from './app.mjs';
import { getCurrentUser } from './auth-service.mjs';

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

    const scoreRef = ref(rtdb, `collectCubes/leaderboards/${levelId}/scores/${user.uid}`);
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
    const leaderboardRef = ref(rtdb, `collectCubes/leaderboards/${levelId}/scores`);
    const unsubscribe = onValue(leaderboardRef, (snapshot) => {
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

    const presenceRef = ref(rtdb, `collectCubes/presence/${user.uid}`);
    await set(presenceRef, serverTimestamp());
    await onDisconnect(presenceRef).remove();

    return () => set(presenceRef, null);
}

/**
 * @param {(count: number) => void} callback - Online count listener.
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeOnlineCount(callback) {
    const presenceRef = ref(rtdb, 'collectCubes/presence');
    const unsubscribe = onValue(presenceRef, (snapshot) => {
        callback(snapshot.exists() ? Object.keys(snapshot.val()).length : 0);
    });
    return () => unsubscribe();
}
