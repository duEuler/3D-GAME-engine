import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const GAME_DURATION = 60;
const PLAYER_SPEED = 8;
const COLLECT_RADIUS = 1.1;
const ARENA_HALF = 7;
const TOTAL_COLLECTIBLES = 12;
const IS_TOUCH_DEVICE = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const assets = {
    font: new pc.Asset('font', 'font', { url: './assets/fonts/courier.json' })
};

const device = await pc.createGraphicsDevice(canvas, {
    deviceTypes: ['webgl2']
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.keyboard = new pc.Keyboard(document.body);
createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScreenComponentSystem,
    pc.ElementComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.FontHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

/**
 * @param {pc.Color} color - Material diffuse color.
 * @returns {pc.StandardMaterial} A standard material.
 */
function createMaterial(color) {
    const material = new pc.StandardMaterial();
    material.diffuse = color;
    material.update();
    return material;
}

const playerMaterial = createMaterial(new pc.Color(0.2, 0.6, 1));
const floorMaterial = createMaterial(new pc.Color(0.25, 0.3, 0.35));
const collectibleMaterial = createMaterial(new pc.Color(1, 0.85, 0.2));
const wallMaterial = createMaterial(new pc.Color(0.45, 0.45, 0.5));

/** @type {pc.Entity[]} */
const collectibles = [];

let score = 0;
let timeLeft = GAME_DURATION;
let gameOver = false;
/** @type {pc.Entity | null} */
let player = null;
/** @type {{ x: number, z: number }} */
const touchInput = { x: 0, z: 0 };
let restartQueued = false;

/**
 * @returns {{ destroy: () => void }} Touch joystick controller.
 */
function createTouchJoystick() {
    const base = document.createElement('div');
    base.id = 'joystick';
    base.style.cssText = [
        'position:fixed',
        'left:max(16px, env(safe-area-inset-left))',
        'bottom:max(16px, env(safe-area-inset-bottom))',
        'width:128px',
        'height:128px',
        'border-radius:50%',
        'background:rgba(255,255,255,0.12)',
        'border:2px solid rgba(255,255,255,0.35)',
        'z-index:1000',
        'touch-action:none'
    ].join(';');

    const knob = document.createElement('div');
    knob.style.cssText = [
        'position:absolute',
        'left:50%',
        'top:50%',
        'width:52px',
        'height:52px',
        'margin:-26px 0 0 -26px',
        'border-radius:50%',
        'background:rgba(120,190,255,0.85)',
        'border:2px solid rgba(255,255,255,0.8)',
        'transform:translate(0,0)'
    ].join(';');
    base.appendChild(knob);
    document.body.appendChild(base);

    const radius = 38;
    let activeTouchId = null;

    const updateKnob = (clientX, clientY) => {
        const rect = base.getBoundingClientRect();
        const centerX = rect.left + rect.width * 0.5;
        const centerY = rect.top + rect.height * 0.5;
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const length = Math.hypot(dx, dy);
        if (length > radius) {
            dx = (dx / length) * radius;
            dy = (dy / length) * radius;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        touchInput.x = dx / radius;
        touchInput.z = dy / radius;
    };

    const resetKnob = () => {
        activeTouchId = null;
        knob.style.transform = 'translate(0,0)';
        touchInput.x = 0;
        touchInput.z = 0;
    };

    base.addEventListener('touchstart', (event) => {
        event.preventDefault();
        const touch = event.changedTouches[0];
        activeTouchId = touch.identifier;
        updateKnob(touch.clientX, touch.clientY);
    }, { passive: false });

    base.addEventListener('touchmove', (event) => {
        event.preventDefault();
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            if (touch.identifier === activeTouchId) {
                updateKnob(touch.clientX, touch.clientY);
            }
        }
    }, { passive: false });

    base.addEventListener('touchend', resetKnob);
    base.addEventListener('touchcancel', resetKnob);

    return { destroy: () => base.remove() };
}

const touchJoystick = IS_TOUCH_DEVICE ? createTouchJoystick() : null;
app.on('destroy', () => touchJoystick?.destroy());

/**
 * @param {pc.Entity} screen - UI screen entity.
 * @param {pc.Asset} font - Font asset.
 * @param {string} name - Entity name.
 * @param {string} text - Initial label text.
 * @param {number} anchorY - Vertical anchor.
 * @param {number} fontSize - Font size.
 * @returns {pc.Entity} Text entity.
 */
function createHudText(screen, font, name, text, anchorY, fontSize) {
    const label = new pc.Entity(name);
    label.addComponent('element', {
        type: pc.ELEMENTTYPE_TEXT,
        anchor: new pc.Vec4(0.5, anchorY, 0.5, anchorY),
        pivot: new pc.Vec2(0.5, 0.5),
        fontAsset: font.id,
        fontSize,
        text,
        color: new pc.Color(1, 1, 1),
        outlineColor: new pc.Color(0, 0, 0),
        outlineThickness: 0.6
    });
    screen.addChild(label);
    return label;
}

/**
 * @param {pc.Vec3} position - World position.
 * @returns {pc.Entity} Collectible entity.
 */
function spawnCollectible(position) {
    const cube = new pc.Entity('collectible');
    cube.addComponent('render', { type: 'box', material: collectibleMaterial });
    cube.setLocalScale(0.7, 0.7, 0.7);
    cube.setPosition(position);
    app.root.addChild(cube);
    collectibles.push(cube);
    return cube;
}

function resetCollectibles() {
    collectibles.splice(0).forEach((entity) => entity.destroy());
    for (let i = 0; i < TOTAL_COLLECTIBLES; i++) {
        spawnCollectible(new pc.Vec3(
            pc.math.random(-ARENA_HALF + 1, ARENA_HALF - 1),
            0.5,
            pc.math.random(-ARENA_HALF + 1, ARENA_HALF - 1)
        ));
    }
}

function restartGame() {
    score = 0;
    timeLeft = GAME_DURATION;
    gameOver = false;
    restartQueued = false;
    player?.setPosition(0, 0.5, 0);
    resetCollectibles();
}

new pc.AssetListLoader(Object.values(assets), app.assets).load(() => {
    app.start();
    app.scene.ambientLight = new pc.Color(0.35, 0.35, 0.4);

    const floor = new pc.Entity('floor');
    floor.addComponent('render', { type: 'box', material: floorMaterial });
    floor.setLocalScale(ARENA_HALF * 2 + 2, 0.2, ARENA_HALF * 2 + 2);
    floor.setPosition(0, -0.1, 0);
    app.root.addChild(floor);

    const wallThickness = 0.4;
    const wallHeight = 1.2;
    const wallSpan = ARENA_HALF * 2 + 2;
    const wallData = [
        { pos: [0, wallHeight * 0.5, ARENA_HALF + 1], scale: [wallSpan, wallHeight, wallThickness] },
        { pos: [0, wallHeight * 0.5, -ARENA_HALF - 1], scale: [wallSpan, wallHeight, wallThickness] },
        { pos: [ARENA_HALF + 1, wallHeight * 0.5, 0], scale: [wallThickness, wallHeight, wallSpan] },
        { pos: [-ARENA_HALF - 1, wallHeight * 0.5, 0], scale: [wallThickness, wallHeight, wallSpan] }
    ];
    wallData.forEach((wall, index) => {
        const entity = new pc.Entity(`wall-${index}`);
        entity.addComponent('render', { type: 'box', material: wallMaterial });
        entity.setLocalScale(...wall.scale);
        entity.setPosition(...wall.pos);
        app.root.addChild(entity);
    });

    player = new pc.Entity('player');
    player.addComponent('render', { type: 'box', material: playerMaterial });
    player.setLocalScale(0.9, 0.9, 0.9);
    player.setPosition(0, 0.5, 0);
    app.root.addChild(player);

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.12, 0.16, 0.22),
        farClip: 100
    });
    camera.setPosition(0, 14, 12);
    camera.lookAt(0, 0, 0);
    app.root.addChild(camera);

    const light = new pc.Entity('light');
    light.addComponent('light', {
        type: 'directional',
        castShadows: true,
        shadowBias: 0.2,
        shadowDistance: 30
    });
    light.setEulerAngles(55, 30, 0);
    app.root.addChild(light);

    const screen = new pc.Entity('screen');
    screen.addComponent('screen', {
        referenceResolution: new pc.Vec2(1280, 720),
        scaleBlend: 0.5,
        scaleMode: pc.SCALEMODE_BLEND,
        screenSpace: true
    });
    app.root.addChild(screen);

    const controlHint = IS_TOUCH_DEVICE ? 'Use o joystick' : 'WASD para mover';
    const titleText = createHudText(screen, assets.font, 'title', `Collect Cubes — ${controlHint}`, 0.08, 28);
    const scoreText = createHudText(screen, assets.font, 'score', 'Score: 0', 0.14, 36);
    const timerText = createHudText(screen, assets.font, 'timer', `Time: ${GAME_DURATION}`, 0.2, 36);
    const statusText = createHudText(screen, assets.font, 'status', '', 0.5, 48);
    statusText.element.anchor = new pc.Vec4(0.5, 0.5, 0.5, 0.5);

    resetCollectibles();

    if (IS_TOUCH_DEVICE) {
        canvas.addEventListener('touchend', () => {
            if (gameOver) restartQueued = true;
        }, { passive: true });
    }

    app.on('update', (/** @type {number} */ dt) => {
        const keyboard = app.keyboard;
        if (keyboard.wasPressed(pc.KEY_SPACE) || restartQueued) {
            restartGame();
            scoreText.element.text = 'Score: 0';
        }

        if (!gameOver) {
            timeLeft = Math.max(0, timeLeft - dt);
            if (timeLeft <= 0) {
                gameOver = true;
                statusText.element.text = IS_TOUCH_DEVICE ?
                    'Tempo esgotado! Toque para reiniciar' :
                    'Tempo esgotado! Pressione ESPAÇO';
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
                move.normalize().mulScalar(PLAYER_SPEED * dt);
                const position = player.getPosition().add(move);
                position.x = pc.math.clamp(position.x, -ARENA_HALF, ARENA_HALF);
                position.z = pc.math.clamp(position.z, -ARENA_HALF, ARENA_HALF);
                player.setPosition(position);
            }

            if (player) {
                const playerPos = player.getPosition();
                for (let i = collectibles.length - 1; i >= 0; i--) {
                    const collectible = collectibles[i];
                    if (playerPos.distance(collectible.getPosition()) <= COLLECT_RADIUS) {
                        collectible.destroy();
                        collectibles.splice(i, 1);
                        score++;
                        scoreText.element.text = `Score: ${score}`;
                        if (!collectibles.length) {
                            gameOver = true;
                            statusText.element.text = IS_TOUCH_DEVICE ?
                                `Você venceu! Score: ${score}. Toque para reiniciar` :
                                `Você venceu! Score: ${score}. Pressione ESPAÇO`;
                        }
                    }
                }
            }
        }

        timerText.element.text = `Time: ${Math.ceil(timeLeft)}`;
        titleText.element.text = gameOver ? 'Collect Cubes' : `Collect Cubes — ${controlHint}`;
    });
});
