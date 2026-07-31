// @config
// @title Collect Cubes
// @description Mini arcade game: move with WASD, collect golden cubes before time runs out. Press Space to restart.
// @flag NO_MINISTATS

import * as pc from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const GAME_DURATION = 60;
const PLAYER_SPEED = 8;
const COLLECT_RADIUS = 1.1;
const ARENA_HALF = 7;
const TOTAL_COLLECTIBLES = 12;

const assets = {
    font: new pc.Asset('font', 'font', { url: './assets/fonts/courier.json' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
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
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

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

/**
 * @param {pc.Entity} screen - UI screen entity.
 * @param {pc.Asset} font - Font asset.
 * @param {string} name - Entity name.
 * @param {string} text - Initial label text.
 * @param {number} anchorY - Vertical anchor (0 top, 1 bottom).
 * @param {number} fontSize - Font size in pixels.
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
    cube.addComponent('render', {
        type: 'box',
        material: collectibleMaterial
    });
    cube.setLocalScale(0.7, 0.7, 0.7);
    cube.setPosition(position);
    app.root.addChild(cube);
    collectibles.push(cube);
    return cube;
}

/**
 * @returns {void}
 */
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

/**
 * @returns {void}
 */
function restartGame() {
    score = 0;
    timeLeft = GAME_DURATION;
    gameOver = false;
    player.setPosition(0, 0.5, 0);
    resetCollectibles();
}

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    app.scene.ambientLight = new pc.Color(0.35, 0.35, 0.4);

    const floor = new pc.Entity('floor');
    floor.addComponent('render', {
        type: 'box',
        material: floorMaterial
    });
    floor.setLocalScale(ARENA_HALF * 2 + 2, 0.2, ARENA_HALF * 2 + 2);
    floor.setPosition(0, -0.1, 0);
    app.root.addChild(floor);

    const wallThickness = 0.4;
    const wallHeight = 1.2;
    const wallSpan = ARENA_HALF * 2 + 2;
    const wallPositions = [
        [0, wallHeight * 0.5, ARENA_HALF + 1],
        [0, wallHeight * 0.5, -ARENA_HALF - 1],
        [ARENA_HALF + 1, wallHeight * 0.5, 0],
        [-ARENA_HALF - 1, wallHeight * 0.5, 0]
    ];
    const wallScales = [
        [wallSpan, wallHeight, wallThickness],
        [wallSpan, wallHeight, wallThickness],
        [wallThickness, wallHeight, wallSpan],
        [wallThickness, wallHeight, wallSpan]
    ];
    wallPositions.forEach((position, index) => {
        const wall = new pc.Entity(`wall-${index}`);
        wall.addComponent('render', {
            type: 'box',
            material: wallMaterial
        });
        wall.setLocalScale(...wallScales[index]);
        wall.setPosition(...position);
        app.root.addChild(wall);
    });

    const player = new pc.Entity('player');
    player.addComponent('render', {
        type: 'box',
        material: playerMaterial
    });
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

    const titleText = createHudText(screen, assets.font, 'title', 'Collect Cubes — WASD to move', 0.08, 28);
    const scoreText = createHudText(screen, assets.font, 'score', 'Score: 0', 0.14, 36);
    const timerText = createHudText(screen, assets.font, 'timer', `Time: ${GAME_DURATION}`, 0.2, 36);
    const statusText = createHudText(screen, assets.font, 'status', '', 0.5, 48);
    statusText.element.align = pc.Vec2.ZERO;
    statusText.element.anchor = new pc.Vec4(0.5, 0.5, 0.5, 0.5);

    resetCollectibles();

    app.on('update', (/** @type {number} */ dt) => {
        const keyboard = app.keyboard;

        if (keyboard.wasPressed(pc.KEY_SPACE)) {
            restartGame();
        }

        if (!gameOver) {
            timeLeft = Math.max(0, timeLeft - dt);
            if (timeLeft <= 0) {
                gameOver = true;
                statusText.element.text = 'Time up! Press SPACE to restart';
            }

            const move = new pc.Vec3();
            if (keyboard.isPressed(pc.KEY_W) || keyboard.isPressed(pc.KEY_UP)) move.z -= 1;
            if (keyboard.isPressed(pc.KEY_S) || keyboard.isPressed(pc.KEY_DOWN)) move.z += 1;
            if (keyboard.isPressed(pc.KEY_A) || keyboard.isPressed(pc.KEY_LEFT)) move.x -= 1;
            if (keyboard.isPressed(pc.KEY_D) || keyboard.isPressed(pc.KEY_RIGHT)) move.x += 1;

            if (move.lengthSq() > 0) {
                move.normalize().mulScalar(PLAYER_SPEED * dt);
                const position = player.getPosition().add(move);
                position.x = pc.math.clamp(position.x, -ARENA_HALF, ARENA_HALF);
                position.z = pc.math.clamp(position.z, -ARENA_HALF, ARENA_HALF);
                player.setPosition(position);
            }

            const playerPos = player.getPosition();
            for (let i = collectibles.length - 1; i >= 0; i--) {
                const collectible = collectibles[i];
                if (playerPos.distance(collectible.getPosition()) <= COLLECT_RADIUS) {
                    collectible.destroy();
                    collectibles.splice(i, 1);
                    score++;
                    scoreText.element.text = `Score: ${score}`;

                    if (collectibles.length === 0) {
                        gameOver = true;
                        statusText.element.text = `You win! Score: ${score}. Press SPACE to restart`;
                    }
                }
            }
        }

        timerText.element.text = `Time: ${Math.ceil(timeLeft)}`;
        titleText.element.text = gameOver ? 'Collect Cubes' : 'Collect Cubes — WASD to move';
    });
});
