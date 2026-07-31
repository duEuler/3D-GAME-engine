import { getApp } from '../firebase/core.mjs';

/** @type {import('firebase/database').Database | null} */
let rtdb = null;

/**
 * @returns {Promise<import('firebase/auth').User>}
 */
async function requireUser() {
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js');
    const auth = getAuth(await getApp());
    if (auth.currentUser) {
        return auth.currentUser;
    }
    const { ensureSignedIn } = await import('../firebase/auth-service.mjs');
    return ensureSignedIn();
}

/**
 * @returns {Promise<import('firebase/database').Database>}
 */
async function getRtdb() {
    if (rtdb) return rtdb;
    const { getApp } = await import('../firebase/core.mjs');
    const { getDatabase } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    rtdb = getDatabase(await getApp());
    return rtdb;
}

/**
 * Gera código de sala de 6 caracteres.
 * @returns {string}
 */
export function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

/**
 * @typedef {object} RoomPlayer
 * @property {string} displayName
 * @property {string} characterId
 * @property {string} colorHex
 * @property {boolean} ready
 * @property {number} score
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {object} RoomState
 * @property {string} hostUid
 * @property {string} levelId
 * @property {'waiting'|'playing'|'finished'} status
 * @property {number} maxPlayers
 * @property {number} [seed]
 * @property {number} [timeLeft]
 * @property {Record<string, RoomPlayer>} players
 * @property {Record<string, {x: number, y: number, z: number, collected: boolean}>} [collectibles]
 */

/**
 * @param {string} code - Room code.
 * @returns {Promise<(RoomState & {code: string}) | null>}
 */
export async function getRoom(code) {
    const user = await requireUser();
    if (!user) return null;

    const { ref, get } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();
    const snap = await get(ref(database, `collectCubes/rooms/${code}`));
    if (!snap.exists()) return null;
    return { code, ...snap.val() };
}

/**
 * Cria sala com retry automático de código e verificação pós-escrita.
 * @param {string} levelId
 * @param {object} playerInfo
 * @returns {Promise<string>} Room code.
 */
export async function createRoomForLevel(levelId, playerInfo) {
    const user = await requireUser();
    await leaveMatchmaking();

    const { ref, set, get } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();

    for (let attempt = 0; attempt < 8; attempt++) {
        const code = generateRoomCode();
        const roomRef = ref(database, `collectCubes/rooms/${code}`);
        const existing = await get(roomRef);
        if (existing.exists()) continue;

        try {
            await set(roomRef, {
                hostUid: user.uid,
                levelId,
                status: 'waiting',
                maxPlayers: 8,
                createdAt: Date.now(),
                players: {
                    [user.uid]: {
                        displayName: playerInfo.displayName,
                        characterId: playerInfo.characterId,
                        colorHex: playerInfo.colorHex,
                        ready: true,
                        score: 0,
                        x: 0,
                        y: 0.5,
                        z: 0
                    }
                }
            });

            const verify = await get(roomRef);
            if (!verify.exists()) {
                throw new Error('Sala criada mas não encontrada. Verifique sua conexão.');
            }
            return code;
        } catch (error) {
            const fbCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
            if (fbCode === 'PERMISSION_DENIED') {
                throw new Error('Sem permissão no Firebase. Saia e entre novamente (Google ou convidado).');
            }
            if (attempt === 7) throw error;
        }
    }

    throw new Error('Não foi possível criar sala. Tente novamente.');
}

/**
 * @param {string} code - Room code.
 * @param {object} playerInfo
 * @param {string} playerInfo.displayName
 * @param {string} playerInfo.characterId
 * @param {string} playerInfo.colorHex
 * @returns {Promise<void>}
 */
export async function joinRoom(code, playerInfo) {
    const user = await requireUser();

    const { ref, get, update, runTransaction } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();
    const roomRef = ref(database, `collectCubes/rooms/${code}`);

    const snap = await get(roomRef);
    if (!snap.exists()) throw new Error('Sala não encontrada');
    const room = snap.val();
    if (room.status !== 'waiting') throw new Error('Partida já iniciada');
    if (Object.keys(room.players || {}).length >= (room.maxPlayers || 8)) {
        throw new Error('Sala cheia');
    }

    await update(ref(database, `collectCubes/rooms/${code}/players/${user.uid}`), {
        displayName: playerInfo.displayName,
        characterId: playerInfo.characterId,
        colorHex: playerInfo.colorHex,
        ready: false,
        score: 0,
        x: 0,
        y: 0.5,
        z: 0
    });
}

/**
 * @param {string} code - Room code.
 * @returns {Promise<void>}
 */
export async function leaveRoom(code) {
    const user = await requireUser().catch(() => null);
    if (!user) return;

    const { ref, get, remove, update } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();
    const roomRef = ref(database, `collectCubes/rooms/${code}`);
    const snap = await get(roomRef);
    if (!snap.exists()) return;

    const room = snap.val();
    await remove(ref(database, `collectCubes/rooms/${code}/players/${user.uid}`));

    const remaining = Object.keys(room.players || {}).filter((uid) => uid !== user.uid);
    if (!remaining.length) {
        await remove(roomRef);
    } else if (room.hostUid === user.uid) {
        await update(roomRef, { hostUid: remaining[0] });
    }
}

/**
 * @param {string} code - Room code.
 * @param {boolean} ready - Ready state.
 * @returns {Promise<void>}
 */
export async function setPlayerReady(code, ready) {
    const user = await requireUser().catch(() => null);
    if (!user) return;

    const { ref, update } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();
    await update(ref(database, `collectCubes/rooms/${code}/players/${user.uid}`), { ready });
}

/**
 * @param {string} code - Room code.
 * @param {number} seed - Random seed.
 * @param {Record<string, {x: number, y: number, z: number, collected: boolean}>} collectibles
 * @returns {Promise<void>}
 */
export async function startRoomGame(code, seed, collectibles) {
    const user = await requireUser();

    const { ref, get, update } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();
    const roomRef = ref(database, `collectCubes/rooms/${code}`);
    const snap = await get(roomRef);
    if (!snap.exists()) throw new Error('Sala não encontrada');

    const room = snap.val();
    if (room.hostUid !== user.uid) throw new Error('Apenas o host pode iniciar');
    if (room.status !== 'waiting') throw new Error('Partida já iniciada');

    const players = room.players || {};
    const allReady = Object.values(players).every((p) => p.ready);
    if (!allReady || Object.keys(players).length < 1) {
        throw new Error('Todos os jogadores devem estar prontos');
    }

    await update(roomRef, {
        status: 'playing',
        seed,
        timeLeft: null,
        startedAt: Date.now(),
        collectibles
    });
}

/**
 * @param {string} code - Room code.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {Promise<void>}
 */
export async function updatePlayerPosition(code, x, y, z) {
    const user = await requireUser().catch(() => null);
    if (!user) return;

    const { ref, update } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();
    await update(ref(database, `collectCubes/rooms/${code}/players/${user.uid}`), { x, y, z });
}

/**
 * @param {string} code - Room code.
 * @param {number} score
 * @returns {Promise<void>}
 */
export async function updatePlayerScore(code, score) {
    const user = await requireUser().catch(() => null);
    if (!user) return;

    const { ref, update } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();
    await update(ref(database, `collectCubes/rooms/${code}/players/${user.uid}`), { score });
}

/**
 * @param {string} code - Room code.
 * @param {string} collectibleId
 * @returns {Promise<boolean>} True if collected successfully.
 */
export async function collectCubeInRoom(code, collectibleId) {
    const user = await requireUser().catch(() => null);
    if (!user) return false;

    const { ref, runTransaction } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();
    const cubeRef = ref(database, `collectCubes/rooms/${code}/collectibles/${collectibleId}`);

    const result = await runTransaction(cubeRef, (current) => {
        if (!current || current.collected) return;
        return { ...current, collected: true, collectedBy: user.uid };
    });

    return result.committed;
}

/**
 * @param {string} code - Room code.
 * @returns {Promise<void>}
 */
export async function finishRoomGame(code) {
    const user = await requireUser().catch(() => null);
    if (!user) return;

    const { ref, get, update } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();
    const roomRef = ref(database, `collectCubes/rooms/${code}`);
    const snap = await get(roomRef);
    if (!snap.exists()) return;

    const room = snap.val();
    if (room.hostUid !== user.uid) return;

    await update(roomRef, { status: 'finished', finishedAt: Date.now() });
}

/**
 * @param {string} code - Room code.
 * @param {(room: (RoomState & {code: string}) | null, error?: Error) => void} callback
 * @returns {() => void}
 */
export function subscribeRoom(code, callback) {
    let cancelled = false;
    let unsubscribe = () => {};

    getRtdb().then(async (database) => {
        if (cancelled) return;
        const { onValue, ref } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
        const roomRef = ref(database, `collectCubes/rooms/${code}`);
        unsubscribe = onValue(
            roomRef,
            (snapshot) => {
                if (cancelled) return;
                if (!snapshot.exists()) {
                    callback(null);
                    return;
                }
                callback({ code, ...snapshot.val() });
            },
            (error) => {
                if (cancelled) return;
                const err = error instanceof Error ? error : new Error(String(error));
                callback(null, err);
            }
        );
    }).catch((error) => {
        if (!cancelled) {
            callback(null, error instanceof Error ? error : new Error(String(error)));
        }
    });

    return () => {
        cancelled = true;
        unsubscribe();
    };
}

/**
 * Entra na fila de matchmaking.
 * @param {string} levelId
 * @param {object} playerInfo
 * @returns {Promise<void>}
 */
export async function joinMatchmaking(levelId, playerInfo) {
    const user = await requireUser();

    const { ref, set, get, remove } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();

    await set(ref(database, `collectCubes/matchmaking/${user.uid}`), {
        levelId,
        displayName: playerInfo.displayName,
        characterId: playerInfo.characterId,
        colorHex: playerInfo.colorHex,
        joinedAt: Date.now()
    });
}

/**
 * @returns {Promise<void>}
 */
export async function leaveMatchmaking() {
    const user = await requireUser().catch(() => null);
    if (!user) return;

    const { ref, remove } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();
    await remove(ref(database, `collectCubes/matchmaking/${user.uid}`));
}

/**
 * Tenta parear jogadores na fila (host cria sala).
 * @param {string} levelId
 * @returns {Promise<string|null>} Room code if matched.
 */
export async function tryMatchmake(levelId) {
    const user = await requireUser().catch(() => null);
    if (!user) return null;

    const { ref, get, remove, set } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = await getRtdb();
    const queueRef = ref(database, 'collectCubes/matchmaking');
    const snap = await get(queueRef);
    if (!snap.exists()) return null;

    const queue = snap.val();
    const candidates = Object.entries(queue)
        .filter(([uid, data]) => data.levelId === levelId && uid !== user.uid)
        .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));

    if (!candidates.length) return null;

    const [partnerUid, partnerData] = candidates[0];
    const myData = queue[user.uid];
    if (!myData) return null;

    const code = generateRoomCode();
    const roomRef = ref(database, `collectCubes/rooms/${code}`);

    await set(roomRef, {
        hostUid: user.uid,
        levelId,
        status: 'waiting',
        maxPlayers: 8,
        createdAt: Date.now(),
        matchmade: true,
        players: {
            [user.uid]: {
                displayName: myData.displayName,
                characterId: myData.characterId,
                colorHex: myData.colorHex,
                ready: true,
                score: 0,
                x: 0, y: 0.5, z: 0
            },
            [partnerUid]: {
                displayName: partnerData.displayName,
                characterId: partnerData.characterId,
                colorHex: partnerData.colorHex,
                ready: true,
                score: 0,
                x: 2, y: 0.5, z: 0
            }
        }
    });

    await remove(ref(database, `collectCubes/matchmaking/${user.uid}`));
    await remove(ref(database, `collectCubes/matchmaking/${partnerUid}`));

    return code;
}

/**
 * Escuta matchmaking para ser convidado a uma sala.
 * @param {(code: string) => void} onMatched
 * @returns {() => void}
 */
export function subscribeMatchmakingResult(onMatched) {
    let user = null;
    let unsubscribe = () => {};
    let cancelled = false;

    requireUser().then((u) => {
        if (cancelled || !u) return;
        user = u;

        getRtdb().then(async (database) => {
            if (cancelled) return;
            const { onValue, ref, get } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
            const queueRef = ref(database, `collectCubes/matchmaking/${user.uid}`);

            unsubscribe = onValue(queueRef, async (snapshot) => {
                if (cancelled || snapshot.exists()) return;

                const roomsSnap = await get(ref(database, `collectCubes/rooms`)).catch(() => null);
                if (!roomsSnap?.exists()) return;

                const rooms = roomsSnap.val();
                for (const [code, room] of Object.entries(rooms)) {
                    if (room.players?.[user.uid] && room.matchmade) {
                        onMatched(code);
                        return;
                    }
                }
            });
        });
    }).catch(() => {});

    return () => {
        cancelled = true;
        unsubscribe();
    };
}

/**
 * Verifica se todos os jogadores estão prontos.
 * @param {RoomState} room
 * @returns {boolean}
 */
export function allPlayersReady(room) {
    const players = Object.values(room.players || {});
    return players.length > 0 && players.every((p) => p.ready);
}

/**
 * Retorna ranking da sala por score.
 * @param {RoomState} room
 * @returns {Array<{uid: string, displayName: string, score: number}>}
 */
export function getRoomLeaderboard(room) {
    return Object.entries(room.players || {})
        .map(([uid, p]) => ({ uid, displayName: p.displayName, score: p.score || 0 }))
        .sort((a, b) => b.score - a.score);
}
