import { withTimeout } from './firebase/with-timeout.mjs';
import { LEVELS, getLevelById, getUnlockedLevels } from './levels.mjs';
import { CHARACTERS, COLOR_PRESETS, loadCustomization, saveCustomization, resolveCustomization } from './characters.mjs';
import {
    appState, showScreen, hideAllScreens, renderCardGrid,
    renderColorPicker, renderLobbyPlayers, renderResultsList
} from './ui/menu-controller.mjs';

const AUTH_VERSION = '14';

/** @type {typeof import('./debug-panel.mjs') | null} */
let debug = null;

const menu = document.getElementById('app-menu');
const userLabel = document.getElementById('user-label');
const onlineLabel = document.getElementById('online-label');
const leaderboardList = document.getElementById('leaderboard-list');
const leaderboardTitle = document.getElementById('leaderboard-title');
const continueButton = document.getElementById('boot-shell-continue');

/** @type {typeof import('./firebase/auth-service.mjs') | null} */
let authApi = null;
/** @type {typeof import('./firebase/firestore-service.mjs') | null} */
let firestoreApi = null;
/** @type {typeof import('./firebase/realtime-service.mjs') | null} */
let realtimeApi = null;
/** @type {typeof import('./multiplayer/room-service.mjs') | null} */
let roomApi = null;
/** @type {typeof import('./safe-action.mjs') | null} */
let safeAction = null;

/** @type {(() => void) | null} */
let stopLiveLeaderboard = null;
/** @type {(() => void) | null} */
let stopOnlineListener = null;
/** @type {(() => void) | null} */
let stopPresence = null;
/** @type {(() => void) | null} */
let stopRoomListener = null;
/** @type {(() => void) | null} */
let stopMatchmakingListener = null;

/** @type {Record<string, number>} */
let bestScores = {};
/** @type {boolean} */
let playInProgress = false;
/** @type {boolean} */
let isReady = false;
/** @type {string} */
let launchingRoomCode = '';
/** @type {ReturnType<typeof setInterval> | null} */
let matchmakingInterval = null;

/**
 * @param {unknown} error
 * @param {string} [context]
 */
function showError(error, context = '') {
    if (debug?.isAuthError?.(error)) {
        debug.showAuthPrompt(error instanceof Error ? error.message : String(error));
        return;
    }
    debug?.bootError(error, context);
    debug?.showErrorDialog(error, context);
}

/**
 * Atualiza banner de login no menu principal.
 */
function updateAuthBanner() {
    const banner = document.getElementById('auth-banner');
    const signedIn = authApi?.isSignedIn?.() ?? false;
    if (banner) banner.hidden = signedIn;
}

/**
 * Garante login antes de ações online. Mostra diálogo amigável se falhar.
 * @returns {Promise<import('firebase/auth').User | null>}
 */
async function ensureAuthForOnline() {
    if (!authApi) {
        debug?.showAuthPrompt('Serviços ainda carregando. Aguarde ou toque em Continuar na tela inicial.');
        return null;
    }

    if (authApi.isSignedIn()) {
        updateAuthBanner();
        return authApi.getCurrentUser();
    }

    try {
        const user = await authApi.ensureSignedIn();
        updateAuthBanner();
        renderUser(user);
        return user;
    } catch (error) {
        updateAuthBanner();
        showError(error, 'Login');
        return null;
    }
}

/**
 * Login via Google com feedback.
 */
async function handleGoogleLogin() {
    if (!authApi || !firestoreApi) {
        debug?.showAuthPrompt('Aguarde o carregamento ou recarregue a página.');
        return;
    }
    const result = await authApi.signInWithGoogle();
    if (!result) {
        debug?.bootLog('Redirecionando para Google...');
        return;
    }
    await firestoreApi.upsertUserProfile(result.user);
    await setupPresence();
    await loadProgress();
    updateAuthBanner();
    renderUser(result.user);
    debug?.bootLog(`Login OK — ${result.user.email || 'conta Google'}`);
}

/**
 * Login convidado com feedback.
 */
async function handleGuestLogin() {
    if (!authApi || !firestoreApi) {
        debug?.showAuthPrompt('Aguarde o carregamento ou recarregue a página.');
        return;
    }
    const result = await authApi.signInAsGuest();
    await firestoreApi.upsertUserProfile(result.user);
    await setupPresence();
    updateAuthBanner();
    renderUser(result.user);
    debug?.bootLog('Login convidado OK');
}

/**
 * @param {import('firebase/auth').User | null} user
 */
function renderUser(user) {
    const logoutBtn = document.getElementById('btn-logout');
    if (!userLabel || !logoutBtn) return;
    if (!user) {
        userLabel.textContent = 'Não conectado — faça login para multiplayer';
        logoutBtn.hidden = true;
        updateAuthBanner();
        return;
    }
    userLabel.textContent = user.isAnonymous ? 'Convidado' : (user.displayName || user.email || 'Jogador');
    logoutBtn.hidden = false;
    updateAuthBanner();
}

/**
 * @param {Array<{displayName: string, score: number}>} entries
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

async function loadProgress() {
    if (!firestoreApi) return;
    bestScores = {};
    for (const level of LEVELS) {
        const progress = await firestoreApi.fetchUserProgress(level.id);
        if (progress) bestScores[level.id] = progress.bestScore;
    }
}

async function refreshLeaderboard() {
    if (!firestoreApi || !realtimeApi || !debug) return;
    const levelId = appState.selectedLevelId;
    if (leaderboardTitle) {
        const level = getLevelById(levelId);
        leaderboardTitle.textContent = `Ranking — ${level?.name || levelId}`;
    }
    debug.setBootStep('ranking', 'loading');
    const entries = await withTimeout(firestoreApi.fetchLeaderboard(levelId), 20000, 'Ranking');
    renderLeaderboard(entries);
    stopLiveLeaderboard?.();
    stopLiveLeaderboard = realtimeApi.subscribeLiveLeaderboard(levelId, renderLeaderboard);
    debug.setBootStep('ranking', 'ok');
}

async function setupPresence() {
    if (!realtimeApi || !debug) return;
    stopPresence?.();
    stopPresence = await realtimeApi.registerPresence();
}

function forceShowMenu() {
    document.body.classList.add('menu-open');
    document.body.classList.remove('booting');
    if (!menu) throw new Error('Elemento #app-menu não encontrado');
    menu.hidden = false;
    menu.removeAttribute('hidden');
    showScreen('main');
}

function hideMenu() {
    document.body.classList.remove('menu-open');
    hideAllScreens();
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

function getPlayerInfo() {
    const user = authApi?.getCurrentUser();
    const custom = appState.customization || loadCustomization();
    return {
        displayName: user?.displayName || 'Jogador',
        characterId: custom.characterId,
        colorHex: custom.colorHex
    };
}

function renderCharacterScreen() {
    const custom = appState.customization || loadCustomization();
    renderCardGrid('character-grid', CHARACTERS.map((c) => ({
        id: c.id, name: c.name, icon: c.icon, subtitle: c.description.slice(0, 40) + '...'
    })), custom.characterId, (id) => {
        custom.characterId = id;
        updateCharacterPreview();
    });
    renderColorPicker('color-picker', COLOR_PRESETS, custom.colorHex, (hex) => {
        custom.colorHex = hex;
        updateCharacterPreview();
    });
    appState.customization = custom;
    updateCharacterPreview();
}

function updateCharacterPreview() {
    const custom = appState.customization || loadCustomization();
    const { character, color } = resolveCustomization(custom);
    const nameEl = document.getElementById('character-preview-name');
    if (nameEl) nameEl.textContent = character.name;

    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('character-preview-canvas'));
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 120, 120);
    ctx.fillStyle = '#1a2330';
    ctx.fillRect(0, 0, 120, 120);
    const hex = `#${Math.round(color.r * 255).toString(16).padStart(2, '0')}${Math.round(color.g * 255).toString(16).padStart(2, '0')}${Math.round(color.b * 255).toString(16).padStart(2, '0')}`;
    ctx.fillStyle = hex;
    if (character.shape === 'sphere') {
        ctx.beginPath();
        ctx.arc(60, 60, 40, 0, Math.PI * 2);
        ctx.fill();
    } else if (character.shape === 'cone') {
        ctx.beginPath();
        ctx.moveTo(60, 15);
        ctx.lineTo(100, 100);
        ctx.lineTo(20, 100);
        ctx.closePath();
        ctx.fill();
    } else if (character.shape === 'capsule') {
        ctx.fillRect(40, 25, 40, 70);
        ctx.beginPath();
        ctx.arc(60, 25, 20, Math.PI, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(60, 95, 20, 0, Math.PI);
        ctx.fill();
    } else {
        ctx.fillRect(30, 30, 60, 60);
    }
}

function renderLevelScreen() {
    const unlocked = getUnlockedLevels(bestScores);
    renderCardGrid('level-grid', LEVELS.map((level) => {
        const locked = !unlocked.some((l) => l.id === level.id);
        const best = bestScores[level.id];
        return {
            id: level.id,
            name: level.name,
            icon: level.icon,
            locked,
            subtitle: locked ?
                `Desbloqueie com ${level.unlockScore} pts na fase anterior` :
                `Melhor: ${best ?? 0} pts · ${level.collectibles} cubos · ${level.duration}s`
        };
    }), appState.selectedLevelId, (id) => {
        appState.selectedLevelId = id;
        renderLevelScreen();
    });
}

function updateModeScreen() {
    const level = getLevelById(appState.selectedLevelId);
    const nameEl = document.getElementById('mode-level-name');
    if (nameEl && level) nameEl.textContent = level.name;
}

function setLobbyError(message) {
    const el = document.getElementById('lobby-error');
    if (el) {
        el.textContent = message;
        el.hidden = !message;
    }
}

function clearLobbyError() {
    setLobbyError('');
}

function setupLobbyListener(code) {
    stopRoomListener?.();
    const user = authApi?.getCurrentUser();
    if (!user || !roomApi) return;

    let hadRoom = false;

    stopRoomListener = roomApi.subscribeRoom(code, (room, error) => {
        if (error) {
            setLobbyError(`Erro de conexão: ${error.message}`);
            debug?.bootLog(`Lobby RTDB: ${error.message}`, 'error');
            return;
        }

        if (!room) {
            if (hadRoom) {
                setLobbyError('A sala foi encerrada.');
            }
            return;
        }

        hadRoom = true;
        clearLobbyError();
        renderLobbyPlayers(room, user.uid);

        const startBtn = document.getElementById('btn-lobby-start');
        if (startBtn) {
            startBtn.hidden = room.hostUid !== user.uid || room.status !== 'waiting';
        }

        if (room.status === 'playing' && !playInProgress && launchingRoomCode !== code) {
            launchingRoomCode = code;
            launchMultiplayerGame(code);
        }
    });
}

async function launchSoloGame() {
    if (playInProgress) return;
    playInProgress = true;
    try {
        debug?.bootLog('▶ Solo...');
        const { loadStartGame } = await import('./engine-loader.mjs');
        debug?.showBootShell();
        await authApi?.ensureSignedIn();
        hideMenu();
        const startGame = await loadStartGame(debug);
        debug?.setBootStep('engine', 'ok', 'Motor 3D — OK');
        debug?.hideBootShell();
        const custom = appState.customization || loadCustomization();
        await withTimeout(startGame({
            levelId: appState.selectedLevelId,
            customization: custom,
            mode: 'solo',
            onFinished: async () => {
                playInProgress = false;
                forceShowMenu();
                await loadProgress();
                renderLevelScreen();
                await refreshLeaderboard();
            }
        }), 60000, 'Cena 3D');
    } catch (error) {
        playInProgress = false;
        forceShowMenu();
        debug?.showBootShell();
        showError(error, 'Solo');
        debug?.showErrorDialog(error, 'Solo');
    }
}

async function launchMultiplayerGame(code) {
    if (playInProgress) return;
    playInProgress = true;
    launchingRoomCode = code;
    try {
        debug?.bootLog('▶ Multiplayer...');
        debug?.showBootShell();
        const { loadStartGame } = await import('./engine-loader.mjs');
        await authApi?.ensureSignedIn();
        hideMenu();
        stopRoomListener?.();
        const startGame = await loadStartGame(debug);
        debug?.setBootStep('engine', 'ok', 'Motor 3D — OK');
        debug?.hideBootShell();
        const custom = appState.customization || loadCustomization();
        await startGame({
            levelId: appState.selectedLevelId,
            customization: custom,
            mode: 'multiplayer',
            roomCode: code,
            onFinished: () => {
                playInProgress = false;
                launchingRoomCode = '';
                forceShowMenu();
            },
            onMultiplayerEnd: (results) => {
                playInProgress = false;
                launchingRoomCode = '';
                appState.lastResults = results;
                renderResultsList(results);
                showScreen('results');
                forceShowMenu();
                refreshLeaderboard().catch((e) => showError(e, 'Ranking'));
            }
        });
    } catch (error) {
        playInProgress = false;
        forceShowMenu();
        if (appState.roomCode) {
            showScreen('lobby');
            setupLobbyListener(appState.roomCode);
        }
        showError(error, 'Multiplayer');
        debug?.showErrorDialog(error, 'Multiplayer');
    }
}

async function createRoom() {
    if (!roomApi) return;
    const user = await ensureAuthForOnline();
    if (!user) return;

    stopRoomListener?.();
    stopMatchmakingListener?.();
    if (matchmakingInterval) {
        clearInterval(matchmakingInterval);
        matchmakingInterval = null;
    }

    debug?.bootLog('Criando sala...');
    const info = getPlayerInfo();
    const code = await roomApi.createRoomForLevel(appState.selectedLevelId, info);

    appState.roomCode = code;
    isReady = true;
    clearLobbyError();
    showScreen('lobby');
    renderLobbyPlayers(await roomApi.getRoom(code), user.uid);
    setupLobbyListener(code);
    debug?.bootLog(`Sala criada: ${code}`);
}

async function joinRoomByCode(code) {
    if (!roomApi) return;
    const user = await ensureAuthForOnline();
    if (!user) return;

    stopRoomListener?.();
    const info = getPlayerInfo();
    await roomApi.joinRoom(code.toUpperCase(), info);
    appState.roomCode = code.toUpperCase();
    isReady = false;
    clearLobbyError();
    showScreen('lobby');
    renderLobbyPlayers(await roomApi.getRoom(appState.roomCode), user.uid);
    setupLobbyListener(appState.roomCode);
}

async function startMatchmaking() {
    if (!roomApi) return;
    const user = await ensureAuthForOnline();
    if (!user) return;

    const statusEl = document.getElementById('matchmaking-status');
    if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = 'Buscando oponente...';
    }

    const info = getPlayerInfo();
    await roomApi.joinMatchmaking(appState.selectedLevelId, info);

    stopMatchmakingListener = roomApi.subscribeMatchmakingResult((code) => {
        if (matchmakingInterval) clearInterval(matchmakingInterval);
        if (statusEl) statusEl.hidden = true;
        appState.roomCode = code;
        showScreen('lobby');
        setupLobbyListener(code);
    });

    matchmakingInterval = setInterval(async () => {
        const code = await roomApi.tryMatchmake(appState.selectedLevelId);
        if (code) {
            if (matchmakingInterval) clearInterval(matchmakingInterval);
            if (statusEl) statusEl.hidden = true;
            appState.roomCode = code;
            showScreen('lobby');
            setupLobbyListener(code);
        }
    }, 3000);
}

function wireUi() {
    if (!safeAction || !debug) return;
    const { safeClick } = safeAction;

    continueButton?.addEventListener('click', safeClick(debug, 'Continuar', async () => {
        debug.continueToMenu();
    }));

    document.getElementById('btn-play')?.addEventListener('click', safeClick(debug, 'Solo', async () => {
        appState.selectedMode = 'solo';
        await launchSoloGame();
    }));

    document.getElementById('btn-multiplayer')?.addEventListener('click', safeClick(debug, 'Multiplayer', async () => {
        const user = await ensureAuthForOnline();
        if (!user) return;
        appState.selectedMode = 'multiplayer';
        updateModeScreen();
        showScreen('mode');
    }));

    document.getElementById('btn-character')?.addEventListener('click', safeClick(debug, 'Personagem', () => {
        renderCharacterScreen();
        showScreen('character');
    }));

    document.getElementById('btn-levels')?.addEventListener('click', safeClick(debug, 'Fases', () => {
        renderLevelScreen();
        showScreen('levels');
    }));

    document.getElementById('btn-save-character')?.addEventListener('click', safeClick(debug, 'Salvar personagem', () => {
        const custom = appState.customization || loadCustomization();
        saveCustomization(custom);
        debug.bootLog('Personagem salvo: ' + custom.characterId);
        showScreen('main');
    }));

    document.getElementById('btn-play-selected-level')?.addEventListener('click', safeClick(debug, 'Jogar fase', async () => {
        if (!getUnlockedLevels(bestScores).some((l) => l.id === appState.selectedLevelId)) {
            showError(new Error('Fase bloqueada'), 'Fases');
            return;
        }
        updateModeScreen();
        showScreen('mode');
    }));

    document.getElementById('btn-mode-solo')?.addEventListener('click', safeClick(debug, 'Modo solo', () => launchSoloGame()));
    document.getElementById('btn-mode-create')?.addEventListener('click', safeClick(debug, 'Criar sala', () => createRoom()));
    document.getElementById('btn-mode-join')?.addEventListener('click', () => {
        const form = document.getElementById('join-room-form');
        if (form) form.hidden = !form.hidden;
    });
    document.getElementById('btn-join-room')?.addEventListener('click', safeClick(debug, 'Entrar sala', async () => {
        const input = /** @type {HTMLInputElement} */ (document.getElementById('room-code-input'));
        const code = input?.value?.trim();
        if (!code || code.length < 4) {
            showError(new Error('Digite um código válido'), 'Sala');
            return;
        }
        await joinRoomByCode(code);
    }));
    document.getElementById('btn-mode-matchmake')?.addEventListener('click', safeClick(debug, 'Matchmaking', () => startMatchmaking()));

    document.getElementById('btn-lobby-ready')?.addEventListener('click', safeClick(debug, 'Pronto', async () => {
        isReady = !isReady;
        await roomApi?.setPlayerReady(appState.roomCode, isReady);
        const btn = document.getElementById('btn-lobby-ready');
        if (btn) btn.textContent = isReady ? 'Cancelar pronto' : 'Estou pronto ✅';
    }));

    document.getElementById('btn-lobby-start')?.addEventListener('click', safeClick(debug, 'Iniciar', async () => {
        const { generateCollectiblePositions } = await import('./levels.mjs');
        const level = getLevelById(appState.selectedLevelId);
        if (!level || !roomApi) return;
        const seed = Date.now();
        const positions = generateCollectiblePositions(level, seed);
        const collectibles = {};
        positions.forEach((p) => { collectibles[p.id] = { x: p.x, y: p.y, z: p.z, collected: false }; });
        await roomApi.startRoomGame(appState.roomCode, seed, collectibles);
    }));

    document.getElementById('btn-results-menu')?.addEventListener('click', () => showScreen('main'));

    document.querySelectorAll('.btn-back-screen').forEach((btn) => {
        btn.addEventListener('click', safeClick(debug, 'Voltar', async () => {
            const target = btn.getAttribute('data-back');
            if (target === 'mode' && appState.roomCode && roomApi) {
                await roomApi.leaveRoom(appState.roomCode);
                stopRoomListener?.();
                if (matchmakingInterval) clearInterval(matchmakingInterval);
                await roomApi.leaveMatchmaking();
            }
            showScreen(target === 'mode' ? 'mode' : 'main');
        }));
    });

    document.getElementById('btn-google')?.addEventListener('click', safeClick(debug, 'Login Google', () => handleGoogleLogin()));
    document.getElementById('btn-guest')?.addEventListener('click', safeClick(debug, 'Login convidado', () => handleGuestLogin()));
    document.getElementById('banner-btn-google')?.addEventListener('click', safeClick(debug, 'Login Google', () => handleGoogleLogin()));
    document.getElementById('banner-btn-guest')?.addEventListener('click', safeClick(debug, 'Login convidado', () => handleGuestLogin()));

    document.getElementById('btn-logout')?.addEventListener('click', safeClick(debug, 'Logout', async () => {
        await authApi.signOutUser();
        updateAuthBanner();
    }));
}

/**
 * @param {typeof import('./debug-panel.mjs')} debugApi
 */
export async function initApp(debugApi) {
    debug = debugApi;
    appState.customization = loadCustomization();

    debug.setAuthPromptCallbacks?.({
        onGoogle: () => handleGoogleLogin(),
        onGuest: () => handleGuestLogin()
    });

    safeAction = await import('./safe-action.mjs');

    try {
        wireUi();
        debug.setBootStep('modules', 'ok');

        debug.setBootStep('firebase', 'loading');
        await import('./firebase/core.mjs?v=' + AUTH_VERSION);
        authApi = await import('./firebase/auth-service.mjs?v=' + AUTH_VERSION);
        firestoreApi = await import('./firebase/firestore-service.mjs?v=' + AUTH_VERSION);
        realtimeApi = await import('./firebase/realtime-service.mjs?v=' + AUTH_VERSION);
        roomApi = await import('./multiplayer/room-service.mjs?v=' + AUTH_VERSION);
        debug.setBootStep('firebase', 'ok');

        debug.setBootStep('auth', 'loading');
        stopOnlineListener = realtimeApi.subscribeOnlineCount((count) => {
            if (onlineLabel) onlineLabel.textContent = `${count} online`;
        });

        await withTimeout(authApi.ensureSignedIn(), 25000, 'Autenticação');
        debug.setBootStep('auth', 'ok');

        if (typeof authApi.completeGoogleRedirectIfNeeded === 'function') {
            try {
                const redirectResult = await authApi.completeGoogleRedirectIfNeeded();
                if (redirectResult?.user) debug.bootLog(`Login Google OK (${redirectResult.user.email || 'conta'})`);
            } catch (error) {
                debug.bootLog(`Retorno Google: ${error instanceof Error ? error.message : String(error)}`, 'warn');
            }
        }

        authApi.onUserChanged(async (user) => {
            renderUser(user);
            if (user && firestoreApi) {
                try {
                    await firestoreApi.upsertUserProfile(user);
                    await setupPresence();
                    await loadProgress();
                } catch (error) {
                    showError(error, 'Perfil');
                }
            }
        });

        await loadProgress();
        await refreshLeaderboard();
        updateAuthBanner();
        markAppReady();
    } catch (error) {
        debug.setBootStep('modules', 'ok');
        debug.setBootStep('firebase', 'error');
        debug.setBootStep('auth', 'error');
        if (continueButton) continueButton.hidden = false;
        updateAuthBanner();
        debug.bootError(error, 'Inicialização');
        debug.showErrorDialog(error, 'Inicialização');
        debug.bootLog('Você pode tocar Continuar e fazer login manualmente.', 'warn');
    }
}

export { forceShowMenu };
