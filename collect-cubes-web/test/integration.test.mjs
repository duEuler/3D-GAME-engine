import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getUnlockedLevels, generateCollectiblePositions, getLevelById } from '../public/js/levels.mjs';
import { loadCustomization, resolveCustomization } from '../public/js/characters.mjs';
import { generateRoomCode, allPlayersReady, getRoomLeaderboard } from '../public/js/multiplayer/room-service.mjs';

describe('Integração — fluxo completo do jogo', () => {
    it('jogador novo começa na fase 1 com cubo herói', () => {
        const unlocked = getUnlockedLevels({});
        assert.equal(unlocked[0].id, 'phase-1');
        const custom = loadCustomization();
        const { character } = resolveCustomization(custom);
        assert.equal(character.id, 'cube-hero');
    });

    it('progressão de fases com pontuações', () => {
        const scores = { 'phase-1': 12, 'phase-2': 18, 'phase-3': 22 };
        const unlocked = getUnlockedLevels(scores);
        assert.equal(unlocked.length, 4);
        assert.ok(unlocked.some((l) => l.id === 'phase-4'));
        assert.ok(!unlocked.some((l) => l.id === 'phase-5'));
    });

    it('partida solo gera cubos válidos para cada fase', () => {
        for (const level of getUnlockedLevels({ 'phase-1': 99, 'phase-2': 99, 'phase-3': 99, 'phase-4': 99 })) {
            const positions = generateCollectiblePositions(level, 42);
            assert.equal(positions.length, level.collectibles);
        }
    });

    it('fluxo multiplayer: sala → prontos → ranking', () => {
        const code = generateRoomCode();
        assert.equal(code.length, 6);

        const room = {
            hostUid: 'host1',
            levelId: 'phase-1',
            status: 'waiting',
            players: {
                host1: { displayName: 'Host', ready: true, score: 0, characterId: 'cube-hero', colorHex: '#3399ff' },
                guest1: { displayName: 'Guest', ready: true, score: 0, characterId: 'sphere-runner', colorHex: '#33cc66' }
            }
        };

        assert.ok(allPlayersReady(room));

        room.status = 'playing';
        room.players.host1.score = 8;
        room.players.guest1.score = 12;

        const results = getRoomLeaderboard(room);
        assert.equal(results[0].displayName, 'Guest');
        assert.equal(results[0].score, 12);
    });

    it('fase 5 tem arena maior e mais cubos', () => {
        const phase5 = getLevelById('phase-5');
        const phase1 = getLevelById('phase-1');
        assert.ok(phase5.arenaHalf > phase1.arenaHalf);
        assert.ok(phase5.collectibles > phase1.collectibles);
        assert.ok(phase5.duration > phase1.duration);
    });
});
