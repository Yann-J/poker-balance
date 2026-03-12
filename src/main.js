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

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.stackValue = parsed.stackValue ?? DEFAULT_STACK;
      state.players = parsed.players?.length
        ? parsed.players
        : defaultPlayers;
    }
  } catch {
    // keep defaults
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
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

  const netByPlayerId = {};
  players.forEach((p) => {
    netByPlayerId[p.id] = p.netPnl;
  });

  const transfers = computeSettlement(netByPlayerId);
  const playerById = Object.fromEntries(players.map((p) => [p.id, p]));

  const settlements = transfers.map((t) => ({
    ...t,
    fromName: playerById[t.fromId]?.name ?? t.fromId,
    toName: playerById[t.toId]?.name ?? t.toId,
  }));

  return { players, settlements };
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
}

init();
