import { computeSettlement } from './settlement.js';
import { render, bindEvents } from './ui.js';

const STORAGE_KEY = 'poker-balance';
const DEFAULT_STACK = 5000;

function nextId() {
  return crypto.randomUUID();
}

const defaultPlayers = [
  { id: nextId(), name: 'Alice', restacks: 0, finalBalance: 5500 },
  { id: nextId(), name: 'Bob', restacks: 0, finalBalance: 4500 },
  { id: nextId(), name: 'Charlie', restacks: 0, finalBalance: 5000 },
];

let state = {
  stackValue: DEFAULT_STACK,
  players: defaultPlayers,
};

function encodeState() {
  try {
    const json = JSON.stringify(state);
    return btoa(encodeURIComponent(json));
  } catch {
    return '';
  }
}

function decodeState(encoded) {
  try {
    const json = decodeURIComponent(atob(encoded));
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed.stackValue === 'number' && Array.isArray(parsed.players)) {
      return parsed;
    }
  } catch {
    // invalid
  }
  return null;
}

function loadFromUrl() {
  const hash = window.location.hash.slice(1);
  if (!hash) return false;
  const parsed = decodeState(hash);
  if (!parsed) return false;
  state.stackValue = parsed.stackValue ?? DEFAULT_STACK;
  state.players = parsed.players.length ? parsed.players : defaultPlayers;
  return true;
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.stackValue = parsed.stackValue ?? DEFAULT_STACK;
      state.players = parsed.players?.length ? parsed.players : defaultPlayers;
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function loadState() {
  if (loadFromUrl()) return;
  if (loadFromStorage()) return;
  state.stackValue = DEFAULT_STACK;
  state.players = [...defaultPlayers];
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  const encoded = encodeState();
  const url = `${window.location.pathname}${window.location.search}#${encoded}`;
  window.history.replaceState(null, '', url);
}

export function getState() {
  return { ...state };
}

export function setStackValue(value) {
  const n = Number(value);
  if (!Number.isNaN(n) && n > 0) state.stackValue = n;
}

export function addPlayer(name = '') {
  state.players = [
    ...state.players,
    { id: nextId(), name: name || 'Player', restacks: 0, finalBalance: state.stackValue },
  ];
}

export function removePlayer(id) {
  state.players = state.players.filter((p) => p.id !== id);
}

export function updatePlayer(id, updates) {
  const idx = state.players.findIndex((p) => p.id === id);
  if (idx < 0) return;
  state.players[idx] = { ...state.players[idx], ...updates };
}

function computeNetPnl(player) {
  const start = state.stackValue;
  const cost = player.restacks * state.stackValue;
  return player.finalBalance - start - cost;
}

function deriveViewState() {
  const players = state.players.map((p) => ({
    ...p,
    startBalance: state.stackValue,
    netPnl: computeNetPnl(p),
  }));

  const totalNet = players.reduce((s, p) => s + p.netPnl, 0);
  const n = players.length;
  const errorPerPlayer = n > 0 && totalNet !== 0 ? totalNet / n : 0;

  const playersWithAdjusted = players.map((p) => ({
    ...p,
    adjustedPnl: p.netPnl - errorPerPlayer,
  }));

  const adjustedByPlayerId = {};
  playersWithAdjusted.forEach((p) => {
    adjustedByPlayerId[p.id] = p.adjustedPnl;
  });

  const transfers = computeSettlement(adjustedByPlayerId);
  const playerById = Object.fromEntries(playersWithAdjusted.map((p) => [p.id, p]));

  const settlements = transfers.map((t) => ({
    ...t,
    fromName: playerById[t.fromId]?.name ?? t.fromId,
    toName: playerById[t.toId]?.name ?? t.toId,
  }));

  return { players: playersWithAdjusted, settlements, totalError: totalNet };
}

function refresh() {
  const view = deriveViewState();
  render(view, state.stackValue);
  saveState();
}

function init() {
  loadState();
  bindEvents(refresh);
  refresh();

  window.addEventListener('hashchange', () => {
    if (loadFromUrl()) refresh();
  });
}

init();
