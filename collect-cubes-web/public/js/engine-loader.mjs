import { withTimeout } from './firebase/with-timeout.mjs';

/**
 * @param {{ bootLog: Function, bootError: Function, setBootStep: Function }} debug - Debug API.
 * @returns {Promise<typeof import('./game.mjs')>}
 */
export async function loadGameModule(debug) {
    debug.setBootStep('engine', 'loading', 'Motor 3D — verificando arquivo');
    debug.bootLog('[Motor] Verificando playcanvas.mjs no servidor...');

    let headResponse;
    try {
        headResponse = await withTimeout(
            fetch('./lib/playcanvas.mjs', { method: 'HEAD', cache: 'no-cache' }),
            15000,
            'Verificação playcanvas.mjs'
        );
    } catch (error) {
        debug.setBootStep('engine', 'error', 'Motor 3D — arquivo inacessível');
        throw error;
    }

    if (!headResponse.ok) {
        const msg = `[Motor] playcanvas.mjs não encontrado (HTTP ${headResponse.status})`;
        debug.setBootStep('engine', 'error', 'Motor 3D — não encontrado');
        throw new Error(msg);
    }

    const bytes = headResponse.headers.get('content-length');
    const sizeLabel = bytes ? `${(Number(bytes) / (1024 * 1024)).toFixed(1)} MB` : 'tamanho desconhecido';
    debug.bootLog(`[Motor] Arquivo OK (${sizeLabel})`);

    debug.bootLog(`[Motor] Baixando PlayCanvas (${sizeLabel}) — aguarde no 4G...`);
    await withTimeout(import('playcanvas'), 120000, 'Download PlayCanvas');
    debug.bootLog('[Motor] PlayCanvas importado com sucesso');

    debug.bootLog('[Motor] Carregando game.mjs...');
    const gameModule = await withTimeout(import('./game.mjs'), 30000, 'game.mjs');
    debug.bootLog('[Motor] game.mjs carregado');

    return gameModule;
}

/**
 * @param {{ bootLog: Function, bootError: Function }} debug - Debug API.
 * @returns {Promise<string>}
 */
export async function probeEngineFile(debug) {
    debug.bootLog('[Motor] Verificando se o motor existe no servidor...');
    try {
        const response = await withTimeout(
            fetch('./lib/playcanvas.mjs', { method: 'HEAD', cache: 'no-cache' }),
            10000,
            'Probe playcanvas'
        );
        if (!response.ok) {
            const msg = `[Motor] NÃO encontrado — HTTP ${response.status}`;
            debug.bootError(new Error(msg), 'Motor');
            return msg;
        }
        const bytes = response.headers.get('content-length');
        const msg = `[Motor] Encontrado (${bytes ? `${(Number(bytes) / (1024 * 1024)).toFixed(1)} MB` : 'OK'}) — toque em Jogar para baixar`;
        debug.bootLog(msg);
        return msg;
    } catch (error) {
        debug.bootError(error, '[Motor] Verificação');
        return String(error);
    }
}
