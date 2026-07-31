/**
 * Controlador de navegação entre telas do menu.
 */

/** @typedef {'main'|'character'|'levels'|'lobby'|'results'|'mode'} ScreenId */

const SCREENS = ['screen-main', 'screen-character', 'screen-levels', 'screen-lobby', 'screen-results', 'screen-mode'];

/** @type {ScreenId} */
let currentScreen = 'main';

/** @type {object} */
export const appState = {
    selectedLevelId: 'phase-1',
    selectedMode: 'solo',
    roomCode: '',
    lastResults: [],
    customization: null
};

/**
 * @param {ScreenId} screenId
 */
export function showScreen(screenId) {
    currentScreen = screenId;
    const targetId = screenId === 'main' ? 'screen-main' : `screen-${screenId}`;

    SCREENS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.hidden = id !== targetId;
    });

    const menu = document.getElementById('app-menu');
    if (menu) menu.hidden = false;
}

/**
 * @returns {ScreenId}
 */
export function getCurrentScreen() {
    return currentScreen;
}

export function hideAllScreens() {
    SCREENS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
    });
    const menu = document.getElementById('app-menu');
    if (menu) menu.hidden = true;
}

/**
 * @param {string} containerId
 * @param {Array<{id: string, name: string, icon: string, locked?: boolean, subtitle?: string}>} items
 * @param {string} selectedId
 * @param {(id: string) => void} onSelect
 */
export function renderCardGrid(containerId, items, selectedId, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    items.forEach((item) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'card-select' + (item.id === selectedId ? ' card-select--active' : '') + (item.locked ? ' card-select--locked' : '');
        card.disabled = !!item.locked;
        card.innerHTML = `
            <img src="${item.icon}" alt="" class="card-select__icon" width="48" height="48">
            <span class="card-select__name">${item.name}</span>
            ${item.subtitle ? `<span class="card-select__sub">${item.subtitle}</span>` : ''}
            ${item.locked ? '<span class="card-select__lock">🔒</span>' : ''}
        `;
        card.addEventListener('click', () => onSelect(item.id));
        container.appendChild(card);
    });
}

/**
 * @param {string} containerId
 * @param {Array<{id: string, name: string, hex: string}>} colors
 * @param {string} selectedHex
 * @param {(hex: string) => void} onSelect
 */
export function renderColorPicker(containerId, colors, selectedHex, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    colors.forEach((color) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'color-swatch' + (color.hex === selectedHex ? ' color-swatch--active' : '');
        btn.style.background = color.hex;
        btn.title = color.name;
        btn.setAttribute('aria-label', color.name);
        btn.addEventListener('click', () => onSelect(color.hex));
        container.appendChild(btn);
    });
}

/**
 * @param {Array<{displayName: string, score: number}>} results
 */
export function renderResultsList(results) {
    const list = document.getElementById('results-list');
    if (!list) return;
    list.innerHTML = '';
    results.forEach((entry, i) => {
        const li = document.createElement('li');
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        li.textContent = `${medal} ${entry.displayName} — ${entry.score} pts`;
        list.appendChild(li);
    });
}

/**
 * @param {import('../multiplayer/room-service.mjs').RoomState & {code?: string} | null} room
 * @param {string} myUid
 */
export function renderLobbyPlayers(room, myUid) {
    const list = document.getElementById('lobby-players');
    if (!list) return;
    list.innerHTML = '';

    if (!room) {
        list.innerHTML = '<li>Sala não encontrada</li>';
        return;
    }

    Object.entries(room.players || {}).forEach(([uid, player]) => {
        const li = document.createElement('li');
        const isHost = uid === room.hostUid;
        const isMe = uid === myUid;
        li.innerHTML = `
            <span class="lobby-player__color" style="background:${player.colorHex}"></span>
            <span>${player.displayName}${isMe ? ' (você)' : ''}${isHost ? ' 👑' : ''}</span>
            <span class="lobby-player__status">${player.ready ? '✅ Pronto' : '⏳ Aguardando'}</span>
        `;
        list.appendChild(li);
    });

    const codeEl = document.getElementById('lobby-code');
    if (codeEl) codeEl.textContent = room.code || appState.roomCode;

    const statusEl = document.getElementById('lobby-status');
    if (statusEl) {
        const count = Object.keys(room.players || {}).length;
        statusEl.textContent = `${count}/${room.maxPlayers || 8} jogadores — ${room.status === 'waiting' ? 'Aguardando' : room.status}`;
    }
}
