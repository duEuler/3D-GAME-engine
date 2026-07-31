/**
 * Safe action wrappers — every user-facing flow reports errors visibly on mobile.
 */

/**
 * @param {unknown} error - Caught error.
 * @returns {string}
 */
export function formatError(error) {
    if (error instanceof Error) {
        return error.stack ? `${error.message}\n${error.stack}` : error.message;
    }
    return String(error);
}

/**
 * @param {typeof import('./debug-panel.mjs')} debug - Debug API.
 * @param {string} label - Action label.
 * @param {() => void | Promise<void>} fn - Action to run.
 * @returns {Promise<void>}
 */
export async function runSafe(debug, label, fn) {
    try {
        debug.bootLog(`▶ ${label}...`);
        await fn();
        debug.bootLog(`✓ ${label}`);
    } catch (error) {
        debug.bootError(error, label);
        debug.showErrorDialog(error, label);
    }
}

/**
 * @param {typeof import('./debug-panel.mjs')} debug - Debug API.
 * @param {string} label - Action label.
 * @param {(event: Event) => void | Promise<void>} fn - Click handler.
 * @returns {(event: Event) => void}
 */
export function safeClick(debug, label, fn) {
    return (event) => {
        event.preventDefault();
        runSafe(debug, label, () => fn(event));
    };
}
