/**
 * Debug panel and boot logging for mobile troubleshooting.
 */

/** @typedef {{ time: string, level: 'info' | 'error' | 'warn', message: string }} DebugEntry */

/** @type {DebugEntry[]} */
const entries = [];

const panel = document.getElementById('debug-panel');
const panelBody = document.getElementById('debug-panel-body');
const panelStatus = document.getElementById('debug-panel-status');
const toggleButton = document.getElementById('btn-debug');
const badge = document.getElementById('debug-badge');
const bootStatus = document.getElementById('boot-status');
const errorToast = document.getElementById('error-toast');

let errorCount = 0;
let panelOpen = false;

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
    if (level === 'error') {
        errorCount++;
        showErrorToast(message);
        openPanel();
        if (toggleButton) toggleButton.classList.add('debug-fab--alert');
    }

    if (bootStatus) {
        const suffix = level === 'error' ? ' — toque aqui p/ detalhes' : '';
        bootStatus.textContent = message + suffix;
        bootStatus.className = `boot-status boot-status--${level}`;
        bootStatus.hidden = false;
    }

    if (badge) {
        badge.textContent = errorCount > 0 ? String(errorCount) : '';
        badge.hidden = errorCount === 0;
    }

    renderPanel();
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
    const short = message.length > 120 ? `${message.slice(0, 117)}...` : message;
    errorToast.textContent = `⚠ ${short} — toque para ver tudo`;
    errorToast.hidden = false;
}

function getEnvironmentInfo() {
    const canvas = document.createElement('canvas');
    const webgl2 = !!canvas.getContext('webgl2');
    const webgl = !!canvas.getContext('webgl');
    return [
        `URL: ${location.href}`,
        `Tela: ${window.innerWidth}x${window.innerHeight}`,
        `Pixel ratio: ${window.devicePixelRatio}`,
        `User-Agent: ${navigator.userAgent}`,
        `WebGL2: ${webgl2 ? 'sim' : 'não'}`,
        `WebGL1: ${webgl ? 'sim' : 'não'}`,
        `Online: ${navigator.onLine ? 'sim' : 'não'}`,
        `Touch: ${('ontouchstart' in window) ? 'sim' : 'não'}`
    ].join('\n');
}

function renderPanel() {
    if (!panelBody) return;

    const lines = [
        '=== AMBIENTE ===',
        getEnvironmentInfo(),
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

function copyLogs() {
    const text = panelBody?.textContent || '';
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

toggleButton?.addEventListener('click', () => {
    setPanelOpen(!panelOpen);
});

bootStatus?.addEventListener('click', () => {
    openPanel();
});

errorToast?.addEventListener('click', () => {
    openPanel();
});

document.getElementById('btn-debug-close')?.addEventListener('click', () => {
    closePanel();
});

document.getElementById('btn-debug-copy')?.addEventListener('click', async () => {
    const text = panelBody?.textContent || '';
    try {
        await copyLogs();
        bootLog('Logs copiados — cole no WhatsApp ou e-mail');
    } catch (error) {
        bootError(error, 'Falha ao copiar');
        window.prompt('Copie os logs manualmente:', text);
    }
});

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

bootLog('Painel de diagnóstico pronto');
renderPanel();

window.collectCubesDebug = { bootLog, bootError, openPanel, closePanel, entries };
