/**
 * Debug panel, boot shell and loading tracker for mobile troubleshooting.
 */

/** @typedef {{ time: string, level: 'info' | 'error' | 'warn', message: string }} DebugEntry */
/** @typedef {'pending' | 'loading' | 'ok' | 'error'} BootStepStatus */

/** @type {DebugEntry[]} */
const entries = [];

/** @type {Record<string, { label: string, status: BootStepStatus }>} */
const bootSteps = {
    html: { label: 'Página HTML', status: 'ok' },
    css: { label: 'Estilos (CSS)', status: 'pending' },
    modules: { label: 'Módulos JavaScript', status: 'pending' },
    firebase: { label: 'Firebase', status: 'pending' },
    auth: { label: 'Autenticação', status: 'pending' },
    ranking: { label: 'Ranking', status: 'pending' },
    engine: { label: 'Motor 3D (ao tocar Jogar)', status: 'pending' }
};

const panel = document.getElementById('debug-panel');
const panelBody = document.getElementById('debug-panel-body');
const panelStatus = document.getElementById('debug-panel-status');
const toggleButton = document.getElementById('btn-debug');
const badge = document.getElementById('debug-badge');
const bootStatus = document.getElementById('boot-status');
const errorToast = document.getElementById('error-toast');
const bootShell = document.getElementById('boot-shell');
const bootShellMessage = document.getElementById('boot-shell-message');
const bootShellSteps = document.getElementById('boot-shell-steps');
const bootShellBar = document.getElementById('boot-shell-bar');
const bootShellCopy = document.getElementById('boot-shell-copy');
const copyErrorBtn = document.getElementById('btn-copy-error');

/** @type {(() => void) | null} */
let onAuthGuestCallback = null;
/** @type {(() => void) | null} */
let onAuthGoogleCallback = null;

/**
 * Registra callbacks para botões de login no diálogo de erro.
 * @param {{ onGuest?: () => void, onGoogle?: () => void }} callbacks
 */
export function setAuthPromptCallbacks(callbacks) {
    onAuthGuestCallback = callbacks.onGuest ?? null;
    onAuthGoogleCallback = callbacks.onGoogle ?? null;
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isAuthError(error) {
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return msg.includes('login') || msg.includes('faça login') || msg.includes('autentic') ||
        msg.includes('não conectado') || msg.includes('signed in');
}

let errorCount = 0;
let panelOpen = false;
let bootShellVisible = true;

const STEP_ICONS = {
    pending: '○',
    loading: '◌',
    ok: '✓',
    error: '✗'
};

/**
 * @param {string} id - Step id.
 * @param {BootStepStatus} status - Step status.
 * @param {string} [detail] - Optional detail text.
 */
export function setBootStep(id, status, detail = '') {
    if (!bootSteps[id]) {
        bootSteps[id] = { label: id, status };
    } else {
        bootSteps[id].status = status;
    }
    if (detail) {
        bootSteps[id].label = detail;
    }
    renderBootShell();
}

/**
 * @returns {void}
 */
export function showBootShell() {
    bootShellVisible = true;
    document.body.classList.add('booting');
    if (bootShell) bootShell.hidden = false;
    renderBootShell();
}

/**
 * @returns {void}
 */
export function hideBootShell() {
    bootShellVisible = false;
    document.body.classList.remove('booting');
    if (bootShell) bootShell.hidden = true;
}

/**
 * @param {string} message - Log message.
 * @param {'info' | 'error' | 'warn'} [level='info'] - Log level.
 */
export function bootLog(message, level = 'info') {
    const entry = {
        time: new Date().toLocaleTimeString('pt-BR'),
        level,
        message
    };
    entries.push(entry);

    if (bootShellMessage && bootShellVisible) {
        bootShellMessage.textContent = message;
        bootShellMessage.className = level === 'error' ? 'boot-shell__message boot-shell__message--error' : 'boot-shell__message';
    }

    if (level === 'error') {
        errorCount++;
        showErrorToast(message);
        showCopyButtons();
        if (toggleButton) toggleButton.classList.add('debug-fab--alert');
    }

    if (bootStatus) {
        const suffix = level === 'error' ? ' — toque p/ detalhes' : '';
        bootStatus.textContent = message + suffix;
        bootStatus.className = `boot-status boot-status--${level}`;
        bootStatus.hidden = bootShellVisible;
    }

    if (badge) {
        badge.textContent = errorCount > 0 ? String(errorCount) : '';
        badge.hidden = errorCount === 0;
    }

    renderPanel();
    renderBootShell();
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[CollectCubes] ${message}`);
}

/**
 * @param {unknown} error - Error object.
 * @param {string} [context] - Error context.
 */
export function bootError(error, context = '') {
    const base = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error && error.stack ? `\n${error.stack}` : '';
    bootLog(context ? `${context}: ${base}${stack}` : `${base}${stack}`, 'error');
}

/**
 * @returns {void}
 */
export function openPanel() {
    setPanelOpen(true);
}

/**
 * @returns {void}
 */
export function closePanel() {
    setPanelOpen(false);
}

function showErrorToast(message) {
    if (!errorToast) return;
    const short = message.length > 100 ? `${message.slice(0, 97)}...` : message;
    errorToast.textContent = `⚠ ${short} — toque p/ ver`;
    errorToast.hidden = false;
}

function getBootProgress() {
    const values = Object.values(bootSteps);
    const done = values.filter((s) => s.status === 'ok').length;
    return Math.round((done / values.length) * 100);
}

function renderBootShell() {
    if (!bootShellSteps) return;

    bootShellSteps.innerHTML = Object.entries(bootSteps).map(([id, step]) => {
        const icon = STEP_ICONS[step.status];
        const cls = `boot-shell__step boot-shell__step--${step.status}`;
        return `<li class="${cls}" data-step="${id}"><span class="boot-shell__icon">${icon}</span> ${step.label}</li>`;
    }).join('');

    if (bootShellBar) {
        bootShellBar.style.width = `${Math.max(8, getBootProgress())}%`;
    }
}

function getEnvironmentInfo() {
    const canvas = document.createElement('canvas');
    const webgl2 = !!canvas.getContext('webgl2');
    const webgl = !!canvas.getContext('webgl') || !!canvas.getContext('experimental-webgl');
    const importMaps = !!(HTMLScriptElement.supports && HTMLScriptElement.supports('importmap'));
    return [
        `URL: ${location.href}`,
        `Tela: ${window.innerWidth}x${window.innerHeight}`,
        `Pixel ratio: ${window.devicePixelRatio}`,
        `Import maps: ${importMaps ? 'sim' : 'NÃO — navegador antigo'}`,
        `User-Agent: ${navigator.userAgent}`,
        `WebGL2: ${webgl2 ? 'sim' : 'não'}`,
        `WebGL1: ${webgl ? 'sim' : 'não'}`,
        `Online: ${navigator.onLine ? 'sim' : 'não'}`,
        `Touch: ${('ontouchstart' in window) ? 'sim' : 'não'}`
    ].join('\n');
}

function renderPanel() {
    if (!panelBody) return;

    const stepLines = Object.entries(bootSteps).map(([id, step]) =>
        `  ${STEP_ICONS[step.status]} ${id}: ${step.label} [${step.status}]`
    );

    const lines = [
        '=== AMBIENTE ===',
        getEnvironmentInfo(),
        '',
        '=== ETAPAS ===',
        ...stepLines,
        '',
        '=== LOGS ===',
        ...entries.map((entry) => `[${entry.time}] ${entry.level.toUpperCase()}: ${entry.message}`)
    ];

    panelBody.textContent = lines.join('\n');

    if (panelStatus) {
        panelStatus.textContent = errorCount > 0 ?
            `${errorCount} erro(s) — copie e envie ao desenvolvedor` :
            'Nenhum erro registrado';
    }
}

function setPanelOpen(open) {
    panelOpen = open;
    if (!panel) return;
    panel.hidden = !open;
    if (toggleButton) {
        toggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
        const label = toggleButton.childNodes[0];
        if (label && label.nodeType === Node.TEXT_NODE) {
            label.textContent = open ? 'Fechar ' : 'Diagnóstico ';
        }
    }
}

function showCopyButtons() {
    if (bootShellCopy) bootShellCopy.hidden = false;
    if (copyErrorBtn) copyErrorBtn.hidden = false;
}

function getReportText() {
    renderPanel();
    return panelBody?.textContent || entries.map((e) => e.message).join('\n');
}

/**
 * @returns {Promise<void>}
 */
export async function copyReport() {
    const text = getReportText();
    try {
        await copyText(text);
        bootLog('Erro copiado — cole no WhatsApp ou e-mail', 'info');
    } catch (error) {
        window.prompt('Copie o erro manualmente:', text);
    }
}

function copyText(text) {
    if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text);
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return Promise.resolve();
}

function copyLogs() {
    return copyText(getReportText());
}

function wireUi() {
    toggleButton?.addEventListener('click', () => setPanelOpen(!panelOpen));
    bootStatus?.addEventListener('click', () => openPanel());
    errorToast?.addEventListener('click', () => openPanel());
    copyErrorBtn?.addEventListener('click', () => copyReport());
    document.getElementById('btn-debug-close')?.addEventListener('click', () => closePanel());
    document.getElementById('boot-shell-debug')?.addEventListener('click', () => openPanel());
    bootShellCopy?.addEventListener('click', () => copyReport());
    document.getElementById('error-dialog-copy')?.addEventListener('click', () => copyReport());
    document.getElementById('error-dialog-close')?.addEventListener('click', () => hideErrorDialog());
    document.getElementById('error-dialog-debug')?.addEventListener('click', () => openPanel());
    document.getElementById('error-dialog-google')?.addEventListener('click', () => {
        hideErrorDialog();
        onAuthGoogleCallback?.();
    });
    document.getElementById('error-dialog-guest')?.addEventListener('click', () => {
        hideErrorDialog();
        onAuthGuestCallback?.();
    });
    document.getElementById('btn-debug-copy')?.addEventListener('click', () => copyReport());
}

/**
 * @param {unknown} error - Error object.
 * @param {string} [context] - Error context.
 */
export function showErrorDialog(error, context = '') {
    const dialog = document.getElementById('error-dialog');
    const body = document.getElementById('error-dialog-body');
    const title = document.getElementById('error-dialog-title');
    const authSection = document.getElementById('error-dialog-auth');
    if (!dialog || !body) {
        openPanel();
        return;
    }

    const base = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error && error.stack ? `\n\n${error.stack}` : '';
    const text = context ? `${context}:\n${base}${stack}` : `${base}${stack}`;
    const needsAuth = isAuthError(error);

    if (title) {
        title.textContent = needsAuth ? 'Login necessário' : (context ? `Erro: ${context}` : 'Erro');
    }
    body.textContent = needsAuth ?
        `${base}\n\nEscolha uma opção abaixo para continuar:` :
        text;

    if (authSection) authSection.hidden = !needsAuth;
    dialog.hidden = false;
    showCopyButtons();
}

/**
 * Exibe diálogo pedindo login (sem erro técnico).
 * @param {string} [reason]
 */
export function showAuthPrompt(reason = 'Para usar o multiplayer, faça login primeiro.') {
    showErrorDialog(new Error(reason), 'Login');
}

function hideErrorDialog() {
    const dialog = document.getElementById('error-dialog');
    if (dialog) dialog.hidden = true;
}

/**
 * @returns {void}
 */
export function continueToMenu() {
    try {
        bootLog('Continuar — abrindo menu...');
        hideBootShell();
        document.body.classList.add('menu-open');
        document.body.classList.remove('booting');

        const menu = document.getElementById('app-menu');
        if (!menu) {
            throw new Error('#app-menu não existe no DOM');
        }

        menu.hidden = false;
        menu.removeAttribute('hidden');
        menu.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:50000',
            'display:grid', 'place-items:center', 'padding:16px',
            'background:rgba(8,12,18,0.97)', 'overflow:auto'
        ].join(';');

        if (bootStatus) {
            bootStatus.hidden = false;
            bootStatus.textContent = 'Menu aberto — toque em Jogar';
        }

        if (toggleButton) toggleButton.hidden = false;

        bootLog('✓ Menu visível — toque em Jogar');
    } catch (error) {
        bootError(error, 'Continuar');
        showErrorDialog(error, 'Continuar');
        showBootShell();
        const contBtn = document.getElementById('boot-shell-continue');
        if (contBtn) contBtn.hidden = false;
    }
}

/**
 * @returns {void}
 */
export function installGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
        bootError(event.error || event.message, 'Erro global');
    });

    window.addEventListener('unhandledrejection', (event) => {
        bootError(event.reason, 'Promise rejeitada');
    });
}

/**
 * @returns {void}
 */
export function checkCssLoaded() {
    const sheet = Array.from(document.styleSheets).find((s) => {
        try {
            return s.href && s.href.includes('style.css');
        } catch {
            return false;
        }
    });
    if (sheet) {
        setBootStep('css', 'ok');
    } else {
        setBootStep('css', 'error', 'Estilos (CSS) — não carregou');
        bootLog('CSS não carregou — interface pode estar invisível', 'warn');
    }
}

wireUi();
checkCssLoaded();
setBootStep('modules', 'loading');
bootLog('Aguardando bootstrap...');
renderBootShell();

const WATCHDOG_MS = [8000, 16000, 30000];
WATCHDOG_MS.forEach((ms) => {
    setTimeout(() => {
        const step = bootSteps.modules;
        if (step?.status === 'loading') {
            const pending = Object.entries(bootSteps)
                .filter(([, s]) => s.status === 'loading' || s.status === 'pending')
                .map(([id]) => id)
                .join(', ');
            bootLog(
                `Carregamento lento (${Math.round(ms / 1000)}s). Pendente: ${pending || 'módulos'}. ` +
                'Toque em Continuar se o botão aparecer, ou verifique sua conexão.',
                'warn'
            );
        }
    }, ms);
});

window.collectCubesDebug = {
    bootLog, bootError, openPanel, closePanel, setBootStep, showBootShell, hideBootShell,
    copyReport, continueToMenu, showErrorDialog, showAuthPrompt, isAuthError, setAuthPromptCallbacks, entries
};
