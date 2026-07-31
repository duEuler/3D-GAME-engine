/**
 * Configuração das fases do Collect Cubes.
 * @typedef {object} LevelConfig
 * @property {string} id - Identificador único.
 * @property {string} name - Nome exibido.
 * @property {string} description - Descrição curta.
 * @property {number} duration - Duração em segundos.
 * @property {number} collectibles - Quantidade de cubos.
 * @property {number} arenaHalf - Metade do tamanho da arena.
 * @property {number} playerSpeed - Velocidade do jogador.
 * @property {number} collectRadius - Raio de coleta.
 * @property {string} icon - Caminho do ícone SVG.
 * @property {number} unlockScore - Pontuação mínima na fase anterior para desbloquear.
 * @property {number} order - Ordem de exibição.
 * @property {object} [ambient] - Cor ambiente RGB 0-1.
 * @property {boolean} [obstacles] - Se tem obstáculos.
 */

/** @type {LevelConfig[]} */
export const LEVELS = [
    {
        id: 'phase-1',
        name: 'Fase 1 — Tutorial',
        description: 'Aprenda a coletar cubos na arena básica.',
        duration: 60,
        collectibles: 12,
        arenaHalf: 7,
        playerSpeed: 8,
        collectRadius: 1.1,
        icon: './assets/icons/phase-1.svg',
        unlockScore: 0,
        order: 1,
        ambient: { r: 0.35, g: 0.35, b: 0.4 }
    },
    {
        id: 'phase-2',
        name: 'Fase 2 — Corrida',
        description: 'Arena maior, menos tempo, mais cubos!',
        duration: 45,
        collectibles: 20,
        arenaHalf: 9,
        playerSpeed: 9,
        collectRadius: 1.1,
        icon: './assets/icons/phase-2.svg',
        unlockScore: 8,
        order: 2,
        ambient: { r: 0.3, g: 0.38, b: 0.45 }
    },
    {
        id: 'phase-3',
        name: 'Fase 3 — Labirinto',
        description: 'Obstáculos no caminho. Planeje sua rota.',
        duration: 90,
        collectibles: 15,
        arenaHalf: 10,
        playerSpeed: 7.5,
        collectRadius: 1.2,
        icon: './assets/icons/phase-3.svg',
        unlockScore: 15,
        order: 3,
        obstacles: true,
        ambient: { r: 0.28, g: 0.32, b: 0.38 }
    },
    {
        id: 'phase-4',
        name: 'Fase 4 — Noite',
        description: 'Luz reduzida. Cubos brilham na escuridão.',
        duration: 60,
        collectibles: 25,
        arenaHalf: 11,
        playerSpeed: 8.5,
        collectRadius: 1.15,
        icon: './assets/icons/phase-4.svg',
        unlockScore: 20,
        order: 4,
        ambient: { r: 0.12, g: 0.14, b: 0.2 }
    },
    {
        id: 'phase-5',
        name: 'Fase 5 — Desafio Final',
        description: 'Arena gigante. 30 cubos. Você consegue?',
        duration: 120,
        collectibles: 30,
        arenaHalf: 14,
        playerSpeed: 9,
        collectRadius: 1.1,
        icon: './assets/icons/phase-5.svg',
        unlockScore: 25,
        order: 5,
        obstacles: true,
        ambient: { r: 0.25, g: 0.28, b: 0.35 }
    }
];

/**
 * @param {string} levelId - Level identifier.
 * @returns {LevelConfig | undefined}
 */
export function getLevelById(levelId) {
    return LEVELS.find((level) => level.id === levelId);
}

/**
 * @param {Record<string, number>} [bestScores] - Best score per level id.
 * @returns {LevelConfig[]}
 */
export function getUnlockedLevels(bestScores = {}) {
    return LEVELS.filter((level) => {
        if (level.unlockScore === 0) return true;
        const prevLevel = LEVELS.find((l) => l.order === level.order - 1);
        if (!prevLevel) return true;
        return (bestScores[prevLevel.id] ?? 0) >= level.unlockScore;
    });
}

/**
 * @param {string} levelId - Level identifier.
 * @param {Record<string, number>} [bestScores] - Best score per level id.
 * @returns {boolean}
 */
export function isLevelUnlocked(levelId, bestScores = {}) {
    return getUnlockedLevels(bestScores).some((level) => level.id === levelId);
}

/**
 * Gera posições de coletáveis evitando sobreposição.
 * @param {LevelConfig} level - Level config.
 * @param {number} [seed=0] - Seed opcional para multiplayer.
 * @returns {Array<{x: number, y: number, z: number, id: string}>}
 */
export function generateCollectiblePositions(level, seed = 0) {
    const positions = [];
    const minDist = 1.5;
    const margin = 1.2;
    const half = level.arenaHalf - margin;

    let rng = seed || Date.now();
    const random = () => {
        rng = (rng * 1103515245 + 12345) & 0x7fffffff;
        return (rng % 10000) / 10000;
    };

    for (let i = 0; i < level.collectibles; i++) {
        let attempts = 0;
        let x = 0;
        let z = 0;
        let valid = false;

        while (!valid && attempts < 80) {
            x = random() * half * 2 - half;
            z = random() * half * 2 - half;
            valid = positions.every((p) => {
                const dx = p.x - x;
                const dz = p.z - z;
                return Math.hypot(dx, dz) >= minDist;
            });
            attempts++;
        }

        positions.push({ x, y: 0.5, z, id: `c${i}` });
    }

    return positions;
}

/**
 * Gera posições de obstáculos para fases com labirinto.
 * @param {LevelConfig} level - Level config.
 * @returns {Array<{x: number, y: number, z: number, sx: number, sy: number, sz: number}>}
 */
export function generateObstacles(level) {
    if (!level.obstacles) return [];

    const half = level.arenaHalf - 2;
    const obstacles = [
        { x: 0, y: 0.6, z: 0, sx: 2.5, sy: 1.2, sz: 0.8 },
        { x: half * 0.5, y: 0.6, z: half * 0.4, sx: 0.8, sy: 1.2, sz: 2.5 },
        { x: -half * 0.5, y: 0.6, z: -half * 0.4, sx: 0.8, sy: 1.2, sz: 2.5 },
        { x: -half * 0.3, y: 0.6, z: half * 0.6, sx: 2, sy: 1.2, sz: 0.8 }
    ];

    if (level.order >= 5) {
        obstacles.push(
            { x: half * 0.6, y: 0.6, z: -half * 0.5, sx: 1.5, sy: 1.2, sz: 1.5 },
            { x: -half * 0.7, y: 0.6, z: half * 0.2, sx: 1.5, sy: 1.2, sz: 1.5 }
        );
    }

    return obstacles;
}

/**
 * Verifica colisão jogador-obstáculo (AABB simplificado).
 * @param {number} px - Player X.
 * @param {number} pz - Player Z.
 * @param {Array<{x: number, z: number, sx: number, sz: number}>} obstacles
 * @param {number} playerRadius
 * @returns {boolean}
 */
export function collidesWithObstacle(px, pz, obstacles, playerRadius = 0.5) {
    return obstacles.some((obs) => {
        const halfX = obs.sx * 0.5 + playerRadius;
        const halfZ = obs.sz * 0.5 + playerRadius;
        return Math.abs(px - obs.x) < halfX && Math.abs(pz - obs.z) < halfZ;
    });
}
