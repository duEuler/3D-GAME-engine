import { bootError, bootLog, hideBootShell, setBootStep } from './debug-panel.mjs';
import {
    ensureSignedIn,
    onUserChanged,
    signInAsGuest,
    signInWithGoogle,
    signOutUser
} from './firebase/auth-service.mjs';
import { upsertUserProfile } from './firebase/firestore-service.mjs';
import { registerPresence, subscribeOnlineCount } from './firebase/realtime-service.mjs';

const menu = document.getElementById('app-menu');
const userLabel = document.getElementById('user-label');
const onlineLabel = document.getElementById('online-label');
const leaderboardList = document.getElementById('leaderboard-list');
const playButton = document.getElementById('btn-play');
const googleButton = document.getElementById('btn-google');
const guestButton = document.getElementById('btn-guest');
const logoutButton = document.getElementById('btn-logout');
const continueButton = document.getElementById('boot-shell-continue');

/** @type {(() => void) | null} */
let stopLiveLeaderboard = null;
/** @type {(() => void) | null} */
let stopOnlineListener = null;
/** @type {(() => void) | null} */
let stopPresence = null;

/**
 * @param {unknown} error - Caught error.
 * @param {string} [context] - Error context.
 */
function showError(error, context = '') {
    bootError(error, context);
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
    setBootStep('ranking', 'loading');
    bootLog('Carregando ranking...');
    const { fetchLeaderboard } = await import('./firebase/firestore-service.mjs');
    const { subscribeLiveLeaderboard } = await import('./firebase/realtime-service.mjs');

    stopLiveLeaderboard?.();
    const entries = await fetchLeaderboard('default');
    renderLeaderboard(entries);
    stopLiveLeaderboard = subscribeLiveLeaderboard('default', renderLeaderboard);
    setBootStep('ranking', 'ok');
    bootLog(`Ranking carregado (${entries.length} entradas)`);
}

async function setupPresence() {
    stopPresence?.();
    stopPresence = await registerPresence();
    bootLog('Presença online registrada');
}

function showMenu() {
    document.body.classList.add('menu-open');
    if (menu) menu.hidden = false;
}

function hideMenu() {
    document.body.classList.remove('menu-open');
    if (menu) menu.hidden = true;
}

function markAppReady() {
    setBootStep('modules', 'ok');
    setBootStep('firebase', 'ok');
    setBootStep('auth', 'ok');
    showMenu();
    if (continueButton) continueButton.hidden = false;
    bootLog('Pronto — toque em Continuar ou Jogar');
}

playButton?.addEventListener('click', async () => {
    try {
        bootLog('Carregando motor 3D (~3,6 MB)...');
        setBootStep('engine', 'loading');
        await ensureSignedIn();
        hideMenu();
        hideBootShell();

        const { startGame } = await import('./game.mjs');
        setBootStep('engine', 'ok');
        bootLog('Iniciando jogo...');

        await startGame({
            levelId: 'default',
            onFinished: () => {
                bootLog('Voltando ao menu');
                showMenu();
                refreshLeaderboard().catch((error) => showError(error, 'Ranking'));
            }
        });
        bootLog('Jogo iniciado com sucesso');
    } catch (error) {
        setBootStep('engine', 'error', 'Motor 3D — falhou');
        showMenu();
        showError(error, 'Falha ao iniciar jogo');
    }
});

googleButton?.addEventListener('click', async () => {
    try {
        bootLog('Login Google...');
        const result = await signInWithGoogle();
        await upsertUserProfile(result.user);
        await setupPresence();
        bootLog('Login Google OK');
    } catch (error) {
        showError(error, 'Login Google');
    }
});

guestButton?.addEventListener('click', async () => {
    try {
        bootLog('Login convidado...');
        const result = await signInAsGuest();
        await upsertUserProfile(result.user);
        await setupPresence();
        bootLog('Login convidado OK');
    } catch (error) {
        showError(error, 'Login convidado');
    }
});

logoutButton?.addEventListener('click', async () => {
    try {
        await signOutUser();
        bootLog('Logout OK');
    } catch (error) {
        showError(error, 'Logout');
    }
});

onUserChanged(async (user) => {
    renderUser(user);
    if (user) {
        try {
            await upsertUserProfile(user);
            await setupPresence();
        } catch (error) {
            showError(error, 'Perfil/presença');
        }
    }
});

try {
    setBootStep('firebase', 'loading');
    bootLog('Conectando Firebase...');
    stopOnlineListener = subscribeOnlineCount((count) => {
        if (onlineLabel) onlineLabel.textContent = `${count} online`;
    });

    setBootStep('auth', 'loading');
    await ensureSignedIn();
    setBootStep('auth', 'ok');
    bootLog('Autenticação OK');

    await refreshLeaderboard();
    markAppReady();
} catch (error) {
    setBootStep('firebase', 'error', 'Firebase — falhou');
    setBootStep('auth', 'error', 'Autenticação — falhou');
    showMenu();
    if (continueButton) continueButton.hidden = false;
    showError(error, 'Inicialização');
}
