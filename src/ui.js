import * as app from './main.js';
const stackInput = () => document.getElementById('stack-value');
const addBtn = () => document.getElementById('add-player');
const gridBody = () => document.getElementById('grid-body');

function fmt(n) {
  return Number.isFinite(n) ? String(Math.round(n)) : '-';
}

function settlementsForPlayer(playerId, settlements) {
  const sends = settlements
    .filter((s) => s.fromId === playerId)
    .map((s) => `Sends ${fmt(s.amount)} → ${s.toName}`);
  const receives = settlements
    .filter((s) => s.toId === playerId)
    .map((s) => `Receives ${fmt(s.amount)} from ${s.fromName}`);
  return [...sends, ...receives];
}

function pnlClass(net) {
  if (net > 0) return 'pnl-win';
  if (net < 0) return 'pnl-loss';
  return '';
}

export function render(view, stackValue) {
  const { players, settlements } = view;
  const stackEl = stackInput();
  if (stackEl) stackEl.value = stackValue;

  const body = gridBody();
  if (!body) return;

  const totalStart = players.length * stackValue;
  const totalRestacks = players.reduce((s, p) => s + p.restacks, 0);
  const totalFinal = players.reduce((s, p) => s + p.finalBalance, 0);
  const totalNet = players.reduce((s, p) => s + p.netPnl, 0);
  const totalRowClass = totalNet !== 0 ? 'row-total row-total-error' : 'row-total';

  body.innerHTML =
    players
      .map(
        (p) => `
    <tr data-player-id="${p.id}">
      <td>
        <input type="text" class="cell-name" value="${escapeHtml(p.name)}" data-field="name" />
      </td>
      <td class="cell-start">${fmt(p.startBalance)}</td>
      <td>
        <input type="number" class="cell-restacks" value="${p.restacks}" min="0" step="1" data-field="restacks" />
      </td>
      <td>
        <input type="number" class="cell-final" value="${p.finalBalance}" min="0" step="1" data-field="finalBalance" />
      </td>
      <td class="cell-pnl ${pnlClass(p.netPnl)}">${p.netPnl >= 0 ? '+' : ''}${fmt(p.netPnl)}</td>
      <td class="cell-settlements">${settlementsForPlayer(p.id, settlements).join('<br>') || '—'}</td>
      <td>
        <button type="button" class="btn-remove" data-action="remove" title="Remove">×</button>
      </td>
    </tr>
  `
      )
      .join('') +
    `
    <tr class="${totalRowClass}">
      <td><strong>Total</strong></td>
      <td class="cell-start">${fmt(totalStart)}</td>
      <td>${fmt(totalRestacks)}</td>
      <td>${fmt(totalFinal)}</td>
      <td class="cell-pnl ${pnlClass(totalNet)}">${totalNet >= 0 ? '+' : ''}${fmt(totalNet)}</td>
      <td></td>
      <td></td>
    </tr>
  `;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function selectAllOnFocus(e) {
  e.target.select();
}

export function bindEvents(refresh) {
  const stackEl = stackInput();
  if (stackEl) {
    stackEl.addEventListener('focus', selectAllOnFocus);
    stackEl.addEventListener('change', (e) => {
      app.setStackValue(e.target.value);
      refresh();
    });
  }

  addBtn()?.addEventListener('click', () => {
    app.addPlayer();
    refresh();
  });

  gridBody()?.addEventListener('focusin', (e) => {
    const input = e.target.closest('input');
    if (input) input.select();
  });

  gridBody()?.addEventListener('change', (e) => {
    const input = e.target.closest('input');
    if (!input) return;
    const row = input.closest('tr');
    const id = row?.dataset?.playerId;
    if (!id) return;
    const field = input.dataset?.field;
    if (!field) return;
    const val = field === 'name' ? input.value : Number(input.value);
    app.updatePlayer(id, { [field]: val });
    refresh();
  });

  gridBody()?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="remove"]');
    if (!btn) return;
    const row = btn.closest('tr');
    const id = row?.dataset?.playerId;
    if (!id) return;
    app.removePlayer(id);
    refresh();
  });
}
