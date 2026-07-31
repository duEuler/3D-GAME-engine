import {
    ensureSignedIn,
    onUserChanged,
    signInAsGuest,
    signInWithGoogle,
    signOutUser
} from './firebase/auth-service.mjs';
import { upsertUserProfile } from './firebase/firestore-service.mjs';
import { registerPresence, subscribeOnlineCount } from './firebase/realtime-service.mjs';
import { startGame } from './game.mjs';

const menu = document.getElementById('app-menu');
const userLabel = document.getElementById('user-label');
const onlineLabel = document.getElementById('online-label');
const leaderboardList = document.getElementById('leaderboard-list');
const playButton = document.getElementById('btn-play');
const googleButton = document.getElementById('btn-google');
const guestButton = document.getElementById('btn-guest');
const logoutButton = document.getElementById('btn-logout');
const errorBanner = document.getElementById('app-error');

/** @type {(() => void) | null} */
let stopLiveLeaderboard = null;
/** @type {(() => void) | null} */
let stopOnlineListener = null;
/** @type {(() => void) | null} */
let stopPresence = null;

/**
 * @param {unknown} error - Caught error.
 */
function showError(error) {
    if (!errorBanner) return;
    const message = error instanceof Error ? error.message : String(error);
    errorBanner.textContent = `Erro: ${message}`;
    errorBanner.hidden = false;
    console.error(error);
}

/**
 * @param {import('firebase/auth').User | null} user - Current user.
 */
function renderUser(user) {
    if (!userLabel || !logoutButton) return;

    if (!user) {
        userLabel.textContent = 'Não conectado';
        logoutButton.hidden = true;
        return;
    }

    const label = user.isAnonymous ? 'Convidado' : (user.displayName || user.email || 'Jogador');
    userLabel.textContent = label;
    logoutButton.hidden = false;
}

/**
 * @param {Array<{displayName: string, score: number}>} entries - Leaderboard rows.
 */
function renderLeaderboard(entries) {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '';
    if (!entries.length) {
        leaderboardList.innerHTML = '<li>Sem pontuações ainda</li>';
        return;
    }

    entries.forEach((entry, index) => {
        const item = document.createElement('li');
        item.textContent = `${index + 1}. ${entry.displayName} — ${entry.score}`;
        leaderboardList.appendChild(item);
    });
}

async function refreshLeaderboard() {
    const { fetchLeaderboard } = await import('./firebase/firestore-service.mjs');
    const { subscribeLiveLeaderboard } = await import('./firebase/realtime-service.mjs');

    stopLiveLeaderboard?.();
    const entries = await fetchLeaderboard('default');
    renderLeaderboard(entries);
    stopLiveLeaderboard = subscribeLiveLeaderboard('default', renderLeaderboard);
}

async function setupPresence() {
    stopPresence?.();
    stopPresence = await registerPresence();
}

function showMenu() {
    if (menu) menu.hidden = false;
}

function hideMenu() {
    if (menu) menu.hidden = true;
}

playButton?.addEventListener('click', async () => {
    try {
        await ensureSignedIn();
        hideMenu();
        await startGame({
            levelId: 'default',
            onFinished: () => {
                showMenu();
                refreshLeaderboard().catch(showError);
            }
        });
    } catch (error) {
        showMenu();
        showError(error);
    }
});

googleButton?.addEventListener('click', async () => {
    try {
        const result = await signInWithGoogle();
        await upsertUserProfile(result.user);
        await setupPresence();
    } catch (error) {
        showError(error);
    }
});

guestButton?.addEventListener('click', async () => {
    try {
        const result = await signInAsGuest();
        await upsertUserProfile(result.user);
        await setupPresence();
    } catch (error) {
        showError(error);
    }
});

logoutButton?.addEventListener('click', async () => {
    try {
        await signOutUser();
    } catch (error) {
        showError(error);
    }
});

onUserChanged(async (user) => {
    renderUser(user);
    if (user) {
        try {
            await upsertUserProfile(user);
            await setupPresence();
        } catch (error) {
            showError(error);
        }
    }
});

try {
    stopOnlineListener = subscribeOnlineCount((count) => {
        if (onlineLabel) onlineLabel.textContent = `${count} online`;
    });

    await ensureSignedIn();
    showMenu();
    await refreshLeaderboard();
} catch (error) {
    showMenu();
    showError(error);
}
