import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    CHARACTERS, COLOR_PRESETS, getCharacterById,
    hexToRgb, rgbToHex, loadCustomization, saveCustomization, resolveCustomization
} from '../public/js/characters.mjs';

describe('characters.mjs', () => {
    it('deve ter 4 personagens', () => {
        assert.equal(CHARACTERS.length, 4);
    });

    it('getCharacterById encontra personagem', () => {
        const char = getCharacterById('sphere-runner');
        assert.equal(char.name, 'Esfera Veloz');
        assert.equal(char.shape, 'sphere');
    });

    it('hexToRgb converte cor corretamente', () => {
        const rgb = hexToRgb('#ff0000');
        assert.equal(rgb.r, 1);
        assert.equal(rgb.g, 0);
        assert.equal(rgb.b, 0);
    });

    it('rgbToHex converte de volta', () => {
        assert.equal(rgbToHex({ r: 0, g: 1, b: 0 }), '#00ff00');
    });

    it('saveCustomization e loadCustomization persistem dados', () => {
        const original = globalThis.localStorage;
        const store = new Map();
        globalThis.localStorage = {
            getItem: (k) => store.get(k) ?? null,
            setItem: (k, v) => store.set(k, v)
        };

        saveCustomization({ characterId: 'capsule-ninja', colorHex: '#9966ff' });
        const loaded = loadCustomization();
        assert.equal(loaded.characterId, 'capsule-ninja');
        assert.equal(loaded.colorHex, '#9966ff');

        globalThis.localStorage = original;
    });

    it('resolveCustomization retorna personagem e cor', () => {
        const result = resolveCustomization({ characterId: 'pyramid-mage', colorHex: '#ff8833' });
        assert.equal(result.character.id, 'pyramid-mage');
        assert.ok(result.color.r > 0.9);
    });

    it('COLOR_PRESETS tem 8 cores', () => {
        assert.equal(COLOR_PRESETS.length, 8);
    });
});
