const IS_TOUCH_DEVICE = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const POSITION_SYNC_INTERVAL = 100;

/** @type {import('playcanvas').AppBase | null} */
let activeApp = null;
/** @type {(() => void) | null} */
let activeCleanup = null;
let hasSavedCurrentRun = false;

/**
 * @typedef {object} StartGameOptions
 * @property {string} levelId
 * @property {import('./characters.mjs').PlayerCustomization} customization
 * @property {'solo'|'multiplayer'} [mode]
 * @property {string} [roomCode]
 * @property {() => void} [onFinished]
 * @property {(results: Array<{displayName: string, score: number}>) => void} [onMultiplayerEnd]
 */

/**
 * @param {StartGameOptions} options
 * @returns {Promise<void>}
 */
export async function startGame(options) {
    const pc = await import('playcanvas');
    const { bootError, bootLog } = await import('./debug-panel.mjs');
    const { getLevelById, generateCollectiblePositions, generateObstacles, collidesWithObstacle } = await import('./levels.mjs');
    const { resolveCustomization } = await import('./characters.mjs');
    const { getCurrentUser } = await import('./firebase/auth-service.mjs');
    const { publishLiveScore } = await import('./firebase/realtime-service.mjs');
    const { saveRunResult } = await import('./firebase/firestore-service.mjs');

    const level = getLevelById(options.levelId);
    if (!level) throw new Error(`Fase não encontrada: ${options.levelId}`);

    const { character, color } = resolveCustomization(options.customization);
    const isMultiplayer = options.mode === 'multiplayer' && options.roomCode;

    let roomApi = null;
    if (isMultiplayer) {
        roomApi = await import('./multiplayer/room-service.mjs');
    }

    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
    const backButton = document.getElementById('btn-back-menu');

    if (activeCleanup) {
        activeCleanup();
        activeCleanup = null;
    }

    hasSavedCurrentRun = false;
    window.focus();
    if (backButton) backButton.hidden = false;

    const assets = {
        font: new pc.Asset('font', 'font', { url: './assets/fonts/courier.json' })
    };

    bootLog(`Fase: ${level.name}`);
    let device;
    try {
        device = await Promise.race([
            pc.createGraphicsDevice(canvas, { deviceTypes: ['webgl2', 'webgpu'] }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('GPU timeout 20s')), 20000))
        ]);
    } catch (firstError) {
        bootError(firstError, 'WebGL2/WebGPU falhou, tentando WebGL1');
        device = await Promise.race([
            pc.createGraphicsDevice(canvas, { deviceTypes: ['webgl1'] }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('WebGL1 timeout 20s')), 20000))
        ]);
    }
    device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.keyboard = new pc.Keyboard(document.body);
    createOptions.componentSystems = [
        pc.RenderComponentSystem, pc.CameraComponentSystem,
        pc.LightComponentSystem, pc.ScreenComponentSystem, pc.ElementComponentSystem
    ];
    createOptions.resourceHandlers = [pc.TextureHandler, pc.FontHandler];

    const app = new pc.AppBase(canvas);
    app.init(createOptions);
    activeApp = app;
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);

    /**
     * @param {{r: number, g: number, b: number}} c
     * @returns {pc.StandardMaterial}
     */
    function createMaterial(c) {
        const m = new pc.StandardMaterial();
        m.diffuse = new pc.Color(c.r, c.g, c.b);
        m.update();
        return m;
    }

    const floorMaterial = createMaterial({ r: 0.25, g: 0.3, b: 0.35 });
    const collectibleMaterial = createMaterial({ r: 1, g: 0.85, b: 0.2 });
    const wallMaterial = createMaterial({ r: 0.45, g: 0.45, b: 0.5 });
    const obstacleMaterial = createMaterial({ r: 0.55, g: 0.35, b: 0.3 });
    const playerMaterial = createMaterial(color);
    const remoteMaterials = new Map();

    /** @type {pc.Entity[]} */
    const collectibleEntities = new Map();
    /** @type {Map<string, pc.Entity>} */
    const remotePlayers = new Map();
    let score = 0;
    let timeLeft = level.duration;
    let gameOver = false;
    /** @type {pc.Entity | null} */
    let player = null;
    const touchInput = { x: 0, z: 0 };
    let restartQueued = false;
    let lastPositionSync = 0;
    let roomUnsubscribe = null;
    const obstacles = generateObstacles(level);
    const user = getCurrentUser();
    const myUid = user?.uid || 'local';

    const seed = isMultiplayer ? Date.now() : 0;
    const initialPositions = generateCollectiblePositions(level, seed);

    function createTouchJoystick() {
        const base = document.createElement('div');
        base.id = 'joystick';
        base.style.cssText = 'position:fixed;left:max(16px,env(safe-area-inset-left));bottom:max(16px,env(safe-area-inset-bottom));width:128px;height:128px;border-radius:50%;background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.35);z-index:1000;touch-action:none';
        const knob = document.createElement('div');
        knob.style.cssText = 'position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(120,190,255,0.85);border:2px solid rgba(255,255,255,0.8);transform:translate(0,0)';
        base.appendChild(knob);
        document.body.appendChild(base);

        const radius = 38;
        let activeTouchId = null;
        const updateKnob = (cx, cy) => {
            const rect = base.getBoundingClientRect();
            let dx = cx - (rect.left + rect.width * 0.5);
            let dy = cy - (rect.top + rect.height * 0.5);
            const len = Math.hypot(dx, dy);
            if (len > radius) { dx = dx / len * radius; dy = dy / len * radius; }
            knob.style.transform = `translate(${dx}px,${dy}px)`;
            touchInput.x = dx / radius;
            touchInput.z = dy / radius;
        };
        const reset = () => { activeTouchId = null; knob.style.transform = 'translate(0,0)'; touchInput.x = 0; touchInput.z = 0; };
        base.addEventListener('touchstart', (e) => { e.preventDefault(); activeTouchId = e.changedTouches[0].identifier; updateKnob(e.changedTouches[0].clientX, e.changedTouches[0].clientY); }, { passive: false });
        base.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === activeTouchId) updateKnob(t.clientX, t.clientY); }, { passive: false });
        base.addEventListener('touchend', reset);
        base.addEventListener('touchcancel', reset);
        return { destroy: () => base.remove() };
    }

    const touchJoystick = IS_TOUCH_DEVICE ? createTouchJoystick() : null;

    function createHudText(screen, font, name, text, anchorY, fontSize) {
        const label = new pc.Entity(name);
        label.addComponent('element', {
            type: pc.ELEMENTTYPE_TEXT,
            anchor: new pc.Vec4(0.5, anchorY, 0.5, anchorY),
            pivot: new pc.Vec2(0.5, 0.5),
            fontAsset: font.id, fontSize, text,
            color: new pc.Color(1, 1, 1),
            outlineColor: new pc.Color(0, 0, 0), outlineThickness: 0.6
        });
        screen.addChild(label);
        return label;
    }

    function spawnCollectible(pos, id) {
        const cube = new pc.Entity(`collectible-${id}`);
        cube.addComponent('render', { type: 'box', material: collectibleMaterial });
        cube.setLocalScale(0.7, 0.7, 0.7);
        cube.setPosition(pos.x, pos.y, pos.z);
        app.root.addChild(cube);
        collectibleEntities.set(id, cube);
    }

    function resetCollectibles() {
        collectibleEntities.forEach((e) => e.destroy());
        collectibleEntities.clear();
        initialPositions.forEach((p) => spawnCollectible(p, p.id));
    }

    function getOrCreateRemotePlayer(uid, charId, colorHex) {
        if (remotePlayers.has(uid)) return remotePlayers.get(uid);
        const { getCharacterById, hexToRgb } = requireCharacters();
        const char = getCharacterById(charId) || character;
        const rgb = hexToRgb(colorHex);
        let mat = remoteMaterials.get(colorHex);
        if (!mat) { mat = createMaterial(rgb); remoteMaterials.set(colorHex, mat); }
        const entity = new pc.Entity(`remote-${uid}`);
        entity.addComponent('render', { type: char.shape, material: mat });
        entity.setLocalScale(char.scale, char.scale, char.scale);
        app.root.addChild(entity);
        remotePlayers.set(uid, entity);
        return entity;
    }

    function requireCharacters() {
        return { getCharacterById: (id) => character.id === id ? character : character, hexToRgb: (h) => {
            const clean = h.replace('#', '');
            const n = parseInt(clean, 16);
            return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
        }};
    }

    function restartGame() {
        score = 0;
        timeLeft = level.duration;
        gameOver = false;
        restartQueued = false;
        hasSavedCurrentRun = false;
        player?.setPosition(0, 0.5, 0);
        resetCollectibles();
    }

    async function persistRun() {
        if (hasSavedCurrentRun || isMultiplayer) return;
        hasSavedCurrentRun = true;
        if (!user) return;
        await saveRunResult(options.levelId, score, timeLeft);
        await publishLiveScore(options.levelId, score, user.displayName || 'Jogador');
    }

    function cleanup() {
        roomUnsubscribe?.();
        backButton?.removeEventListener('click', onBackClick);
        touchJoystick?.destroy();
        window.removeEventListener('resize', resize);
        app.destroy();
        activeApp = null;
        document.getElementById('joystick')?.remove();
        if (backButton) backButton.hidden = true;
    }

    function finishAndReturnToMenu() {
        persistRun();
        cleanup();
        options.onFinished?.();
    }

    const onBackClick = () => {
        if (isMultiplayer && roomApi) {
            roomApi.leaveRoom(options.roomCode).catch(() => {});
        }
        finishAndReturnToMenu();
    };
    backButton?.addEventListener('click', onBackClick);

    activeCleanup = () => {
        if (isMultiplayer && roomApi) roomApi.leaveRoom(options.roomCode).catch(() => {});
        cleanup();
    };

    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Fonte timeout 15s')), 15000);
        new pc.AssetListLoader(Object.values(assets), app.assets).load((err) => {
            clearTimeout(timer);
            if (err) reject(err); else resolve();
        });
    });

    app.start();
    const amb = level.ambient || { r: 0.35, g: 0.35, b: 0.4 };
    app.scene.ambientLight = new pc.Color(amb.r, amb.g, amb.b);

    const half = level.arenaHalf;
    const floor = new pc.Entity('floor');
    floor.addComponent('render', { type: 'box', material: floorMaterial });
    floor.setLocalScale(half * 2 + 2, 0.2, half * 2 + 2);
    floor.setPosition(0, -0.1, 0);
    app.root.addChild(floor);

    const wallH = 1.2;
    const wallSpan = half * 2 + 2;
    [[0, half + 1, wallSpan, 0.4], [0, -half - 1, wallSpan, 0.4], [half + 1, 0, 0.4, wallSpan], [-half - 1, 0, 0.4, wallSpan]]
        .forEach(([x, z, sx, sz], i) => {
            const w = new pc.Entity(`wall-${i}`);
            w.addComponent('render', { type: 'box', material: wallMaterial });
            w.setLocalScale(sx, wallH, sz);
            w.setPosition(x, wallH * 0.5, z);
            app.root.addChild(w);
        });

    obstacles.forEach((obs, i) => {
        const o = new pc.Entity(`obstacle-${i}`);
        o.addComponent('render', { type: 'box', material: obstacleMaterial });
        o.setLocalScale(obs.sx, obs.sy, obs.sz);
        o.setPosition(obs.x, obs.y, obs.z);
        app.root.addChild(o);
    });

    player = new pc.Entity('player');
    player.addComponent('render', { type: character.shape, material: playerMaterial });
    player.setLocalScale(character.scale, character.scale, character.scale);
    player.setPosition(0, 0.5, 0);
    app.root.addChild(player);

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(amb.r * 0.4, amb.g * 0.4, amb.b * 0.5),
        farClip: 100
    });
    const camHeight = half + 7;
    camera.setPosition(0, camHeight, camHeight * 0.85);
    camera.lookAt(0, 0, 0);
    app.root.addChild(camera);

    const light = new pc.Entity('light');
    light.addComponent('light', { type: 'directional', castShadows: true, shadowBias: 0.2, shadowDistance: 40 });
    light.setEulerAngles(55, 30, 0);
    app.root.addChild(light);

    if (level.order >= 4) {
        light.light.intensity = 0.5;
    }

    const screen = new pc.Entity('screen');
    screen.addComponent('screen', {
        referenceResolution: new pc.Vec2(1280, 720),
        scaleBlend: 0.5, scaleMode: pc.SCALEMODE_BLEND, screenSpace: true
    });
    app.root.addChild(screen);

    const hint = IS_TOUCH_DEVICE ? 'Joystick' : 'WASD';
    const modeLabel = isMultiplayer ? 'Multiplayer' : 'Solo';
    const titleText = createHudText(screen, assets.font, 'title', `${level.name} — ${modeLabel}`, 0.06, 24);
    const scoreText = createHudText(screen, assets.font, 'score', 'Score: 0', 0.12, 34);
    const timerText = createHudText(screen, assets.font, 'timer', `Tempo: ${level.duration}`, 0.17, 34);
    const statusText = createHudText(screen, assets.font, 'status', '', 0.5, 42);
    statusText.element.anchor = new pc.Vec4(0.5, 0.5, 0.5, 0.5);

    resetCollectibles();

    if (isMultiplayer && roomApi) {
        roomUnsubscribe = roomApi.subscribeRoom(options.roomCode, (room) => {
            if (!room) return;

            if (room.status === 'finished') {
                gameOver = true;
                const results = roomApi.getRoomLeaderboard(room);
                cleanup();
                options.onMultiplayerEnd?.(results);
                return;
            }

            if (room.collectibles) {
                Object.entries(room.collectibles).forEach(([id, data]) => {
                    if (data.collected && collectibleEntities.has(id)) {
                        collectibleEntities.get(id).destroy();
                        collectibleEntities.delete(id);
                    }
                });
            }

            Object.entries(room.players || {}).forEach(([uid, p]) => {
                if (uid === myUid) {
                    score = p.score || score;
                    scoreText.element.text = `Score: ${score}`;
                    return;
                }
                const remote = getOrCreateRemotePlayer(uid, p.characterId, p.colorHex);
                remote.setPosition(p.x || 0, p.y || 0.5, p.z || 0);
            });
        });
    }

    if (IS_TOUCH_DEVICE) {
        canvas.addEventListener('touchend', () => { if (gameOver && !isMultiplayer) restartQueued = true; }, { passive: true });
    }

    app.on('update', (/** @type {number} */ dt) => {
        const keyboard = app.keyboard;

        if (!isMultiplayer && (keyboard.wasPressed(pc.KEY_SPACE) || restartQueued)) {
            if (gameOver) persistRun();
            restartGame();
            scoreText.element.text = 'Score: 0';
            statusText.element.text = '';
        }

        if (!gameOver) {
            timeLeft = Math.max(0, timeLeft - dt);
            if (timeLeft <= 0) {
                gameOver = true;
                if (isMultiplayer && roomApi) {
                    roomApi.finishRoomGame(options.roomCode).catch(() => {});
                } else {
                    persistRun();
                    statusText.element.text = IS_TOUCH_DEVICE ? 'Tempo esgotado! Toque para reiniciar' : 'Tempo esgotado! ESPAÇO';
                }
            }

            const move = new pc.Vec3();
            if (keyboard.isPressed(pc.KEY_W) || keyboard.isPressed(pc.KEY_UP)) move.z -= 1;
            if (keyboard.isPressed(pc.KEY_S) || keyboard.isPressed(pc.KEY_DOWN)) move.z += 1;
            if (keyboard.isPressed(pc.KEY_A) || keyboard.isPressed(pc.KEY_LEFT)) move.x -= 1;
            if (keyboard.isPressed(pc.KEY_D) || keyboard.isPressed(pc.KEY_RIGHT)) move.x += 1;
            if (IS_TOUCH_DEVICE && (touchInput.x || touchInput.z)) {
                move.x += touchInput.x;
                move.z += touchInput.z;
            }

            if (move.lengthSq() > 0 && player) {
                move.normalize().mulScalar(level.playerSpeed * dt);
                const pos = player.getPosition().clone();
                const newX = pc.math.clamp(pos.x + move.x, -half, half);
                const newZ = pc.math.clamp(pos.z + move.z, -half, half);

                if (!collidesWithObstacle(newX, newZ, obstacles)) {
                    player.setPosition(newX, pos.y, newZ);
                } else if (!collidesWithObstacle(newX, pos.z, obstacles)) {
                    player.setPosition(newX, pos.y, pos.z);
                } else if (!collidesWithObstacle(pos.x, newZ, obstacles)) {
                    player.setPosition(pos.x, pos.y, newZ);
                }

                if (isMultiplayer && roomApi) {
                    const now = Date.now();
                    if (now - lastPositionSync > POSITION_SYNC_INTERVAL) {
                        lastPositionSync = now;
                        const p = player.getPosition();
                        roomApi.updatePlayerPosition(options.roomCode, p.x, p.y, p.z).catch(() => {});
                    }
                }
            }

            if (player) {
                const playerPos = player.getPosition();
                for (const [id, entity] of collectibleEntities) {
                    if (playerPos.distance(entity.getPosition()) <= level.collectRadius) {
                        if (isMultiplayer && roomApi) {
                            roomApi.collectCubeInRoom(options.roomCode, id).then((collected) => {
                                if (collected) {
                                    entity.destroy();
                                    collectibleEntities.delete(id);
                                    score++;
                                    scoreText.element.text = `Score: ${score}`;
                                    roomApi.updatePlayerScore(options.roomCode, score).catch(() => {});
                                }
                            });
                        } else {
                            entity.destroy();
                            collectibleEntities.delete(id);
                            score++;
                            scoreText.element.text = `Score: ${score}`;
                            if (!collectibleEntities.size) {
                                gameOver = true;
                                persistRun();
                                statusText.element.text = IS_TOUCH_DEVICE ?
                                    `Vitória! ${score} pts. Toque p/ reiniciar` :
                                    `Vitória! ${score} pts. ESPAÇO`;
                            }
                        }
                    }
                }
            }
        }

        timerText.element.text = `Tempo: ${Math.ceil(timeLeft)}`;
        titleText.element.text = `${level.name} — ${modeLabel}`;
    });
}
