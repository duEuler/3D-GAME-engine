import { getApp } from './core.mjs';
import { getCurrentUser } from './auth-service.mjs';

/** @type {import('firebase/firestore').Firestore | null} */
let db = null;

/** @type {Promise<import('firebase/firestore').Firestore> | null} */
let dbInitPromise = null;

/**
 * @returns {Promise<import('firebase/firestore').Firestore>}
 */
async function getDb() {
    if (db) return db;

    if (!dbInitPromise) {
        dbInitPromise = (async () => {
            const { getFirestore } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js');
            db = getFirestore(await getApp());
            return db;
        })();
    }

    return dbInitPromise;
}

/**
 * @param {import('firebase/auth').User} user - Authenticated user.
 * @returns {Promise<void>}
 */
export async function upsertUserProfile(user) {
    const { doc, serverTimestamp, setDoc } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js');
    const database = await getDb();
    await setDoc(doc(database, 'users', user.uid), {
        displayName: user.displayName || 'Jogador',
        photoURL: user.photoURL || null,
        isAnonymous: user.isAnonymous,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

/**
 * @param {string} levelId - Level identifier.
 * @param {number} score - Final score.
 * @param {number} timeLeft - Remaining time in seconds.
 * @returns {Promise<void>}
 */
export async function saveRunResult(levelId, score, timeLeft) {
    const user = getCurrentUser();
    if (!user) {
        return;
    }

    const {
        doc,
        getDoc,
        serverTimestamp,
        setDoc
    } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js');
    const database = await getDb();

    const displayName = user.displayName || 'Jogador';
    const progressRef = doc(database, 'users', user.uid, 'progress', levelId);
    const leaderboardRef = doc(database, 'leaderboards', levelId, 'scores', user.uid);

    const progressSnap = await getDoc(progressRef);
    const previousBest = progressSnap.exists() ? progressSnap.data().bestScore ?? 0 : 0;
    const bestScore = Math.max(previousBest, score);

    await setDoc(progressRef, {
        bestScore,
        lastScore: score,
        timeLeft,
        completedAt: serverTimestamp(),
        levelId
    }, { merge: true });

    const leaderboardSnap = await getDoc(leaderboardRef);
    const previousLeaderboard = leaderboardSnap.exists() ? leaderboardSnap.data().score ?? 0 : 0;
    if (score >= previousLeaderboard) {
        await setDoc(leaderboardRef, {
            score,
            displayName,
            photoURL: user.photoURL || null,
            updatedAt: serverTimestamp()
        }, { merge: true });
    }
}

/**
 * @param {string} levelId - Level identifier.
 * @param {number} [maxEntries=10] - Max leaderboard rows.
 * @returns {Promise<Array<{uid: string, score: number, displayName: string}>>}
 */
export async function fetchLeaderboard(levelId, maxEntries = 10) {
    const {
        collection,
        getDocs,
        limit,
        orderBy,
        query
    } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js');
    const database = await getDb();
    const scoresRef = collection(database, 'leaderboards', levelId, 'scores');
    const leaderboardQuery = query(scoresRef, orderBy('score', 'desc'), limit(maxEntries));
    const snapshot = await getDocs(leaderboardQuery);

    return snapshot.docs.map((entry) => ({
        uid: entry.id,
        score: entry.data().score ?? 0,
        displayName: entry.data().displayName ?? 'Jogador'
    }));
}

/**
 * @param {string} levelId - Level identifier.
 * @returns {Promise<{bestScore: number, lastScore: number} | null>}
 */
export async function fetchUserProgress(levelId) {
    const user = getCurrentUser();
    if (!user) {
        return null;
    }

    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js');
    const database = await getDb();
    const progressRef = doc(database, 'users', user.uid, 'progress', levelId);
    const snapshot = await getDoc(progressRef);
    if (!snapshot.exists()) {
        return null;
    }

    return {
        bestScore: snapshot.data().bestScore ?? 0,
        lastScore: snapshot.data().lastScore ?? 0
    };
}
