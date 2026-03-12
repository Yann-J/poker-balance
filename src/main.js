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

// Compact URL format: Rison-like with short keys (s=stack,p=players,i=id,n=name,r=restacks,f=finalBalance)
function risonStr(s) {
  if (/^[a-zA-Z0-9_-]*$/.test(s)) return s;
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function encodeState() {
  try {
    const p = state.players.map((x) => `(n:${risonStr(x.name)},r:${x.restacks},f:${x.finalBalance})`);
    return `(s:${state.stackValue},p:!(${p.join(',')}))`;
  } catch {
    return '';
  }
}

function decodeState(encoded) {
  try {
    let str = encoded;
    if (!encoded.startsWith('(')) {
      try {
        str = decodeURIComponent(atob(encoded));
      } catch {
        str = decodeURIComponent(encoded);
      }
    }
    const parsed = str.startsWith('(') ? risonDecode(str) : JSON.parse(str);
    const stack = parsed?.s ?? parsed?.stackValue;
    const players = parsed?.p ?? parsed?.players;
    if (parsed && typeof stack === 'number' && Array.isArray(players)) {
      return {
        stackValue: stack,
        players: players.map((x) => ({
          id: x.i ?? x.id ?? crypto.randomUUID(),
          name: String(x.n ?? x.name ?? 'Player'),
          restacks: Number(x.r ?? x.restacks ?? 0),
          finalBalance: Number(x.f ?? x.finalBalance ?? stack),
        })),
      };
    }
  } catch {
    // invalid
  }
  return null;
}

function risonDecode(s) {
  let i = 0;
  const skip = () => { while (s[i] === ' ' || s[i] === '\n') i++; };
  const parseVal = () => {
    skip();
    if (s[i] === '!') {
      i++;
      if (s[i] === '(') {
        i++;
        const arr = [];
        while (i < s.length && s[i] !== ')') {
          skip();
          if (s[i] === '(') arr.push(parseVal());
          skip();
          if (s[i] === ',') i++;
        }
        if (s[i] === ')') i++;
        return arr;
      }
      return s[i++] === 't';
    }
    if (s[i] === "'") {
      i++;
      let v = '';
      while (i < s.length) {
        if (s[i] === "'") {
          i++;
          if (s[i] === "'") { v += "'"; i++; }
          else break;
        } else v += s[i++];
      }
      return v;
    }
    if (s[i] === '(') {
      i++;
      const obj = {};
      while (i < s.length && s[i] !== ')') {
        skip();
        let key = '';
        while (s[i] && s[i] !== ':') key += s[i++];
        if (s[i] === ':') i++;
        obj[key] = parseVal();
        skip();
        if (s[i] === ',') i++;
      }
      if (s[i] === ')') i++;
      return obj;
    }
    if (s[i] && /[a-zA-Z_]/.test(s[i])) {
      let v = '';
      while (s[i] && /[a-zA-Z0-9_-]/.test(s[i])) v += s[i++];
      return v;
    }
    let v = '';
    while (s[i] && /[-0-9.eE]/.test(s[i])) v += s[i++];
    return Number(v);
  };
  return parseVal();
}

function loadFromUrl() {
  let hash = window.location.hash.slice(1);
  if (!hash) return false;
  try {
    hash = decodeURIComponent(hash);
  } catch {
    // leave hash as-is if decode fails
  }
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

let ignoreNextHashChange = false;

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  const encoded = encodeState();
  const url = `${window.location.pathname}${window.location.search}#${encoded}`;
  ignoreNextHashChange = true;
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
    if (ignoreNextHashChange) {
      ignoreNextHashChange = false;
      return;
    }
    if (loadFromUrl()) refresh();
  });
}

init();
