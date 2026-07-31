import { withTimeout } from './firebase/with-timeout.mjs';

export const ENGINE_VERSION = '12';

/**
 * @param {{ bootLog: Function, bootError: Function, setBootStep: Function }} debug - Debug API.
 * @returns {Promise<(options: import('./game.mjs').StartGameOptions) => Promise<void>>}
 */
export async function loadStartGame(debug) {
    debug.setBootStep('engine', 'loading', 'Motor 3D — verificando arquivo');
    debug.bootLog('[Motor] Verificando playcanvas.mjs...');

    const headResponse = await withTimeout(
        fetch('./lib/playcanvas.mjs', { method: 'HEAD', cache: 'no-cache' }),
        15000,
        'Verificação playcanvas.mjs'
    );

    if (!headResponse.ok) {
        throw new Error(`[Motor] playcanvas.mjs HTTP ${headResponse.status}`);
    }

    const bytes = headResponse.headers.get('content-length');
    const sizeLabel = bytes ? `${(Number(bytes) / (1024 * 1024)).toFixed(1)} MB` : '? MB';
    debug.bootLog(`[Motor] Arquivo OK (${sizeLabel})`);

    debug.bootLog(`[Motor] Baixando PlayCanvas (${sizeLabel})...`);
    await withTimeout(import('playcanvas'), 120000, 'Download PlayCanvas');
    debug.bootLog('[Motor] PlayCanvas OK');

    debug.bootLog('[Motor] Carregando game.mjs...');
    const mod = await withTimeout(import(`./game.mjs?v=${ENGINE_VERSION}`), 30000, 'game.mjs');
    const startGame = mod.startGame ?? mod.default?.startGame;

    if (typeof startGame !== 'function') {
        const keys = Object.keys(mod).join(', ') || '(vazio)';
        throw new Error(`game.mjs sem startGame. Exports: ${keys}`);
    }

    debug.bootLog('[Motor] startGame pronto');
    return startGame;
}

/**
 * @param {{ bootLog: Function, bootError: Function }} debug - Debug API.
 * @returns {Promise<string>}
 */
export async function probeEngineFile(debug) {
    try {
        const response = await withTimeout(
            fetch('./lib/playcanvas.mjs', { method: 'HEAD', cache: 'no-cache' }),
            10000,
            'Probe playcanvas'
        );
        if (!response.ok) {
            return `[Motor] NÃO encontrado — HTTP ${response.status}`;
        }
        const bytes = response.headers.get('content-length');
        return `[Motor] OK (${bytes ? `${(Number(bytes) / (1024 * 1024)).toFixed(1)} MB` : '?'})`;
    } catch (error) {
        debug.bootError(error, 'Verificação motor');
        return String(error);
    }
}
