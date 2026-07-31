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
        openPanel();
        if (toggleButton) toggleButton.classList.add('debug-fab--alert');
        if (bootShellVisible) showBootShell();
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
    document.getElementById('boot-shell-continue')?.addEventListener('click', () => continueToMenu());
    document.getElementById('btn-debug-copy')?.addEventListener('click', () => copyReport());
}

/**
 * @returns {void}
 */
export function continueToMenu() {
    hideBootShell();
    document.body.classList.add('menu-open');
    document.body.classList.remove('booting');

    const menu = document.getElementById('app-menu');
    if (menu) menu.hidden = false;

    if (bootStatus) {
        bootStatus.hidden = false;
        bootStatus.textContent = 'Menu aberto — toque em Jogar';
    }

    bootLog('Menu aberto — toque em Jogar para carregar o motor 3D');

    import('./engine-loader.mjs').then((loader) => {
        loader.probeEngineFile({ bootLog, bootError, setBootStep });
    }).catch((error) => {
        bootError(error, '[Motor] Probe');
    });
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
        if (step?.status !== 'ok' && step?.status !== 'error') {
            bootLog(`Ainda carregando há ${Math.round(ms / 1000)}s — conexão lenta?`, 'warn');
        }
        if (bootSteps.firebase?.status === 'loading') {
            bootLog(`Firebase ainda baixando (${Math.round(ms / 1000)}s)...`, 'warn');
        }
    }, ms);
});

window.collectCubesDebug = { bootLog, bootError, openPanel, closePanel, setBootStep, showBootShell, hideBootShell, copyReport, continueToMenu, entries };
