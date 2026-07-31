/**
 * Personagens 3D personalizáveis do Collect Cubes.
 * @typedef {object} CharacterConfig
 * @property {string} id - Identificador único.
 * @property {string} name - Nome exibido.
 * @property {string} description - Descrição curta.
 * @property {string} shape - Forma PlayCanvas: box, sphere, capsule, cone.
 * @property {string} icon - Caminho do ícone SVG.
 * @property {{r: number, g: number, b: number}} defaultColor - Cor primária RGB 0-1.
 * @property {{r: number, g: number, b: number}} accentColor - Cor de destaque.
 * @property {number} scale - Escala do modelo.
 */

/** @type {CharacterConfig[]} */
export const CHARACTERS = [
    {
        id: 'cube-hero',
        name: 'Cubo Herói',
        description: 'Equilibrado e confiável. Ideal para iniciantes.',
        shape: 'box',
        icon: './assets/icons/char-cube.svg',
        defaultColor: { r: 0.2, g: 0.6, b: 1 },
        accentColor: { r: 0.1, g: 0.3, b: 0.6 },
        scale: 0.9
    },
    {
        id: 'sphere-runner',
        name: 'Esfera Veloz',
        description: 'Forma arredondada. Desliza pela arena.',
        shape: 'sphere',
        icon: './assets/icons/char-sphere.svg',
        defaultColor: { r: 0.2, g: 0.85, b: 0.45 },
        accentColor: { r: 0.1, g: 0.5, b: 0.25 },
        scale: 0.85
    },
    {
        id: 'capsule-ninja',
        name: 'Cápsula Ninja',
        description: 'Ágil e discreta nas bordas da arena.',
        shape: 'capsule',
        icon: './assets/icons/char-capsule.svg',
        defaultColor: { r: 0.65, g: 0.3, b: 0.95 },
        accentColor: { r: 0.35, g: 0.15, b: 0.55 },
        scale: 0.8
    },
    {
        id: 'pyramid-mage',
        name: 'Pirâmide Mística',
        description: 'Forma única. Destaque-se no multiplayer.',
        shape: 'cone',
        icon: './assets/icons/char-pyramid.svg',
        defaultColor: { r: 1, g: 0.55, b: 0.15 },
        accentColor: { r: 0.7, g: 0.3, b: 0.05 },
        scale: 0.95
    }
];

/** @type {Array<{id: string, name: string, hex: string}>} */
export const COLOR_PRESETS = [
    { id: 'blue', name: 'Azul', hex: '#3399ff' },
    { id: 'green', name: 'Verde', hex: '#33cc66' },
    { id: 'purple', name: 'Roxo', hex: '#9966ff' },
    { id: 'orange', name: 'Laranja', hex: '#ff8833' },
    { id: 'red', name: 'Vermelho', hex: '#ff4444' },
    { id: 'pink', name: 'Rosa', hex: '#ff66aa' },
    { id: 'cyan', name: 'Ciano', hex: '#33dddd' },
    { id: 'yellow', name: 'Amarelo', hex: '#ffcc33' }
];

const STORAGE_KEY = 'collectCubes_character';

/**
 * @param {string} characterId - Character identifier.
 * @returns {CharacterConfig | undefined}
 */
export function getCharacterById(characterId) {
    return CHARACTERS.find((c) => c.id === characterId);
}

/**
 * @param {string} hex - Cor em formato #RRGGBB.
 * @returns {{r: number, g: number, b: number}}
 */
export function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
        r: ((num >> 16) & 255) / 255,
        g: ((num >> 8) & 255) / 255,
        b: (num & 255) / 255
    };
}

/**
 * @param {{r: number, g: number, b: number}} rgb
 * @returns {string}
 */
export function rgbToHex(rgb) {
    const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * @typedef {object} PlayerCustomization
 * @property {string} characterId
 * @property {string} colorHex
 */

/**
 * @returns {PlayerCustomization}
 */
export function loadCustomization() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.characterId && parsed.colorHex) return parsed;
        }
    } catch {
        // ignore
    }
    return { characterId: 'cube-hero', colorHex: '#3399ff' };
}

/**
 * @param {PlayerCustomization} customization
 */
export function saveCustomization(customization) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customization));
}

/**
 * @param {PlayerCustomization} customization
 * @returns {{character: CharacterConfig, color: {r: number, g: number, b: number}}}
 */
export function resolveCustomization(customization) {
    const character = getCharacterById(customization.characterId) || CHARACTERS[0];
    const color = hexToRgb(customization.colorHex);
    return { character, color };
}
