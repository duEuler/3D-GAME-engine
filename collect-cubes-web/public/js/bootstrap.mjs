import { withTimeout } from './firebase/with-timeout.mjs';

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
/** @type {typeof import('./safe-action.mjs') | null} */
let safeAction = null;
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
    const entries = await withTimeout(
        firestoreApi.fetchLeaderboard('default'),
        20000,
        'Ranking'
    );
    renderLeaderboard(entries);
    stopLiveLeaderboard?.();
    stopLiveLeaderboard = realtimeApi.subscribeLiveLeaderboard('default', renderLeaderboard);
    debug.setBootStep('ranking', 'ok');
    debug.bootLog(`Ranking: ${entries.length} entradas`);
}

async function setupPresence() {
    if (!realtimeApi || !debug) return;
    stopPresence?.();
    stopPresence = await realtimeApi.registerPresence();
}

function forceShowMenu() {
    document.body.classList.add('menu-open');
    document.body.classList.remove('booting');

    if (!menu) {
        throw new Error('Elemento #app-menu não encontrado no HTML');
    }

    menu.hidden = false;
    menu.removeAttribute('hidden');
    menu.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:50000',
        'display:grid', 'place-items:center', 'padding:16px',
        'background:rgba(8,12,18,0.97)', 'overflow:auto'
    ].join(';');
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
    debug.setBootStep('ranking', 'ok');
    if (continueButton) {
        continueButton.hidden = false;
        continueButton.removeAttribute('hidden');
    }
    debug.bootLog('Pronto — toque em Continuar');
}

/** @type {boolean} */
let playInProgress = false;

function wireUi() {
    if (!safeAction || !debug) return;
    const { safeClick } = safeAction;

    continueButton?.addEventListener('click', safeClick(debug, 'Continuar', async () => {
        debug.continueToMenu();
    }));

    playButton?.addEventListener('click', async (event) => {
        event.preventDefault();
        if (playInProgress) return;
        playInProgress = true;

        try {
            debug.bootLog('▶ Jogar...');
            const { loadStartGame } = await import('./engine-loader.mjs');

            debug.showBootShell();
            await authApi?.ensureSignedIn();
            hideMenu();

            const startGame = await loadStartGame(debug);
            debug.setBootStep('engine', 'ok', 'Motor 3D — OK');
            debug.hideBootShell();
            debug.bootLog('Iniciando cena 3D...');

            await withTimeout(startGame({
                levelId: 'default',
                onFinished: () => {
                    playInProgress = false;
                    debug.bootLog('Voltando ao menu');
                    forceShowMenu();
                    refreshLeaderboard().catch((error) => showError(error, 'Ranking'));
                }
            }), 60000, 'Cena 3D');

            debug.bootLog('✓ Jogo rodando');
        } catch (error) {
            playInProgress = false;
            debug.setBootStep('engine', 'error', 'Motor 3D — falhou');
            forceShowMenu();
            debug.showBootShell();
            debug.bootError(error, 'Jogar');
            debug.showErrorDialog(error, 'Jogar');
        }
    });

    googleButton?.addEventListener('click', safeClick(debug, 'Login Google', async () => {
        const result = await authApi.signInWithGoogle();
        if (!result) {
            debug.bootLog('Redirecionando para Google...');
            return;
        }
        await firestoreApi.upsertUserProfile(result.user);
        await setupPresence();
    }));

    guestButton?.addEventListener('click', safeClick(debug, 'Login convidado', async () => {
        const result = await authApi.signInAsGuest();
        await firestoreApi.upsertUserProfile(result.user);
        await setupPresence();
    }));

    logoutButton?.addEventListener('click', safeClick(debug, 'Logout', async () => {
        await authApi.signOutUser();
    }));
}

/**
 * @param {typeof import('./debug-panel.mjs')} debugApi - Debug panel API.
 * @returns {Promise<void>}
 */
export async function initApp(debugApi) {
    debug = debugApi;

    safeAction = await import('./safe-action.mjs');

    try {
        wireUi();

        debug.setBootStep('firebase', 'loading');
        await import('./firebase/core.mjs');
        debug.bootLog('Firebase App OK');

        authApi = await import('./firebase/auth-service.mjs');
        debug.bootLog('Firebase Auth OK');

        firestoreApi = await import('./firebase/firestore-service.mjs');
        debug.bootLog('Firestore OK');

        realtimeApi = await import('./firebase/realtime-service.mjs');
        debug.bootLog('Realtime DB OK');
        debug.setBootStep('firebase', 'ok');

        debug.setBootStep('auth', 'loading');
        stopOnlineListener = realtimeApi.subscribeOnlineCount((count) => {
            if (onlineLabel) onlineLabel.textContent = `${count} online`;
        });

        await withTimeout(authApi.ensureSignedIn(), 25000, 'Autenticação');
        debug.setBootStep('auth', 'ok');

        try {
            const redirectResult = await authApi.completeGoogleRedirectIfNeeded();
            if (redirectResult?.user) {
                debug.bootLog(`Login Google OK (${redirectResult.user.email || 'conta'})`);
            }
        } catch (error) {
            showError(error, 'Retorno Google');
        }

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
        if (continueButton) continueButton.hidden = false;
        debug.bootError(error, 'Inicialização');
        debug.showErrorDialog(error, 'Inicialização');
    }
}

// Re-export for continueToMenu
export { forceShowMenu };
