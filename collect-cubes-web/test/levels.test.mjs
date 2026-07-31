import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    LEVELS, getLevelById, getUnlockedLevels, isLevelUnlocked,
    generateCollectiblePositions, generateObstacles, collidesWithObstacle
} from '../public/js/levels.mjs';

describe('levels.mjs', () => {
    it('deve ter 5 fases configuradas', () => {
        assert.equal(LEVELS.length, 5);
    });

    it('getLevelById retorna fase correta', () => {
        const level = getLevelById('phase-3');
        assert.ok(level);
        assert.equal(level.name, 'Fase 3 — Labirinto');
        assert.equal(level.obstacles, true);
    });

    it('fase 1 sempre desbloqueada', () => {
        assert.ok(isLevelUnlocked('phase-1', {}));
    });

    it('fase 2 bloqueada sem pontuação na fase 1', () => {
        assert.ok(!isLevelUnlocked('phase-2', {}));
        assert.ok(isLevelUnlocked('phase-2', { 'phase-1': 10 }));
    });

    it('getUnlockedLevels retorna fases progressivas', () => {
        const unlocked = getUnlockedLevels({ 'phase-1': 20, 'phase-2': 16 });
        assert.equal(unlocked.length, 3);
        assert.equal(unlocked[2].id, 'phase-3');
    });

    it('generateCollectiblePositions gera quantidade correta', () => {
        const level = getLevelById('phase-1');
        const positions = generateCollectiblePositions(level, 12345);
        assert.equal(positions.length, level.collectibles);
        positions.forEach((p) => {
            assert.ok(p.id);
            assert.ok(Math.abs(p.x) < level.arenaHalf);
            assert.ok(Math.abs(p.z) < level.arenaHalf);
        });
    });

    it('generateObstacles retorna vazio sem flag', () => {
        const level = getLevelById('phase-1');
        assert.equal(generateObstacles(level).length, 0);
    });

    it('generateObstacles retorna obstáculos na fase 3', () => {
        const level = getLevelById('phase-3');
        assert.ok(generateObstacles(level).length >= 4);
    });

    it('collidesWithObstacle detecta colisão', () => {
        const obstacles = [{ x: 0, z: 0, sx: 2, sz: 2 }];
        assert.ok(collidesWithObstacle(0, 0, obstacles));
        assert.ok(!collidesWithObstacle(5, 5, obstacles));
    });
});
