import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    generateRoomCode, allPlayersReady, getRoomLeaderboard
} from '../public/js/multiplayer/room-service.mjs';

describe('room-service.mjs', () => {
    it('generateRoomCode gera 6 caracteres', () => {
        const code = generateRoomCode();
        assert.equal(code.length, 6);
        assert.match(code, /^[A-Z2-9]+$/);
    });

    it('generateRoomCode gera códigos diferentes', () => {
        const codes = new Set(Array.from({ length: 20 }, () => generateRoomCode()));
        assert.ok(codes.size > 1);
    });

    it('allPlayersReady retorna true quando todos prontos', () => {
        const room = {
            players: {
                a: { ready: true },
                b: { ready: true }
            }
        };
        assert.ok(allPlayersReady(room));
    });

    it('allPlayersReady retorna false se alguém não pronto', () => {
        const room = {
            players: {
                a: { ready: true },
                b: { ready: false }
            }
        };
        assert.ok(!allPlayersReady(room));
    });

    it('allPlayersReady retorna false sem jogadores', () => {
        assert.ok(!allPlayersReady({ players: {} }));
    });

    it('getRoomLeaderboard ordena por score', () => {
        const room = {
            players: {
                a: { displayName: 'Ana', score: 10 },
                b: { displayName: 'Bob', score: 25 },
                c: { displayName: 'Carlos', score: 15 }
            }
        };
        const board = getRoomLeaderboard(room);
        assert.equal(board[0].displayName, 'Bob');
        assert.equal(board[0].score, 25);
        assert.equal(board[2].displayName, 'Ana');
    });
});
