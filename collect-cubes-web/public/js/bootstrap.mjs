import { withTimeout } from './firebase/with-timeout.mjs';
import { loadGameModule } from './engine-loader.mjs';

/** @type {typeof import('./debug-panel.mjs') | null} */
let debug = null;

const menu = document.getElementById('app-menu');
const userLabel = document.getElementById('user-label');
const onlineLabel = document.getElementById('online-label');
const leaderboardList = document.getElementById('leaderboard-list');
const playButton = document.getElementById('btn-play');
const googleButton = document.getElementById('btn-google');
const guestButton = document.getElementById('btn-guest');
const logoutButton = document.getElementById('btn-logout');
const continueButton = document.getElementById('boot-shell-continue');

/** @type {typeof import('./firebase/auth-service.mjs') | null} */
let authApi = null;
/** @type {typeof import('./firebase/firestore-service.mjs') | null} */
let firestoreApi = null;
/** @type {typeof import('./firebase/realtime-service.mjs') | null} */
let realtimeApi = null;

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
    debug?.bootError(error, context);
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
    if (!firestoreApi || !realtimeApi || !debug) return;

    debug.setBootStep('ranking', 'loading');
    debug.bootLog('Carregando ranking...');

    stopLiveLeaderboard?.();
    const entries = await withTimeout(
        firestoreApi.fetchLeaderboard('default'),
        20000,
        'Ranking'
    );
    renderLeaderboard(entries);
    stopLiveLeaderboard = realtimeApi.subscribeLiveLeaderboard('default', renderLeaderboard);
    debug.setBootStep('ranking', 'ok');
    debug.bootLog(`Ranking carregado (${entries.length} entradas)`);
}

async function setupPresence() {
    if (!realtimeApi || !debug) return;
    stopPresence?.();
    stopPresence = await realtimeApi.registerPresence();
    debug.bootLog('Presença online registrada');
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
    if (!debug) return;
    debug.setBootStep('modules', 'ok');
    debug.setBootStep('firebase', 'ok');
    debug.setBootStep('auth', 'ok');
    showMenu();
    if (continueButton) continueButton.hidden = false;
    debug.bootLog('Pronto — toque em Continuar');
}

function wireUi() {
    playButton?.addEventListener('click', async () => {
        if (!debug) return;
        try {
            showBootShell();
            debug.bootLog('Preparando jogo...');
            await authApi?.ensureSignedIn();
            hideMenu();

            const gameModule = await loadGameModule(debug);
            debug.setBootStep('engine', 'ok', 'Motor 3D — OK');
            debug.hideBootShell();
            debug.bootLog('Iniciando cena 3D...');

            await withTimeout(gameModule.startGame({
                levelId: 'default',
                onFinished: () => {
                    debug.bootLog('Voltando ao menu');
                    showMenu();
                    refreshLeaderboard().catch((error) => showError(error, 'Ranking'));
                }
            }), 60000, 'Inicialização da cena');

            debug.bootLog('Jogo rodando');
        } catch (error) {
            debug.setBootStep('engine', 'error', 'Motor 3D — falhou');
            debug.showBootShell();
            showMenu();
            showError(error, 'Falha ao iniciar jogo');
        }
    });

    googleButton?.addEventListener('click', async () => {
        if (!debug || !authApi || !firestoreApi) return;
        try {
            debug.bootLog('Login Google...');
            const result = await authApi.signInWithGoogle();
            await firestoreApi.upsertUserProfile(result.user);
            await setupPresence();
            debug.bootLog('Login Google OK');
        } catch (error) {
            showError(error, 'Login Google');
        }
    });

    guestButton?.addEventListener('click', async () => {
        if (!debug || !authApi || !firestoreApi) return;
        try {
            debug.bootLog('Login convidado...');
            const result = await authApi.signInAsGuest();
            await firestoreApi.upsertUserProfile(result.user);
            await setupPresence();
            debug.bootLog('Login convidado OK');
        } catch (error) {
            showError(error, 'Login convidado');
        }
    });

    logoutButton?.addEventListener('click', async () => {
        if (!debug || !authApi) return;
        try {
            await authApi.signOutUser();
            debug.bootLog('Logout OK');
        } catch (error) {
            showError(error, 'Logout');
        }
    });
}

/**
 * @param {typeof import('./debug-panel.mjs')} debugApi - Debug panel API.
 * @returns {Promise<void>}
 */
export async function initApp(debugApi) {
    debug = debugApi;
    wireUi();

    try {
        debug.setBootStep('firebase', 'loading');
        debug.bootLog('Baixando Firebase App...');
        await import('./firebase/core.mjs');
        debug.bootLog('Firebase App OK');

        debug.bootLog('Baixando Firebase Auth...');
        authApi = await import('./firebase/auth-service.mjs');
        debug.bootLog('Firebase Auth OK');

        debug.bootLog('Baixando Firestore...');
        firestoreApi = await import('./firebase/firestore-service.mjs');
        debug.bootLog('Firestore OK');

        debug.bootLog('Baixando Realtime Database...');
        realtimeApi = await import('./firebase/realtime-service.mjs');
        debug.bootLog('Firebase completo');

        debug.setBootStep('auth', 'loading');
        debug.bootLog('Entrando como convidado...');
        stopOnlineListener = realtimeApi.subscribeOnlineCount((count) => {
            if (onlineLabel) onlineLabel.textContent = `${count} online`;
        });

        await withTimeout(authApi.ensureSignedIn(), 25000, 'Autenticação');
        debug.setBootStep('auth', 'ok');
        debug.bootLog('Autenticação OK');

        authApi.onUserChanged(async (user) => {
            renderUser(user);
            if (user && firestoreApi) {
                try {
                    await firestoreApi.upsertUserProfile(user);
                    await setupPresence();
                } catch (error) {
                    showError(error, 'Perfil/presença');
                }
            }
        });

        await refreshLeaderboard();
        markAppReady();
    } catch (error) {
        debug.setBootStep('firebase', 'error', 'Firebase — falhou');
        debug.setBootStep('auth', 'error', 'Autenticação — falhou');
        showMenu();
        if (continueButton) continueButton.hidden = false;
        showError(error, 'Inicialização');
    }
}
