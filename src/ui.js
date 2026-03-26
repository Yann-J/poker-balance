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
    .map((s) => `💸 ${fmt(s.amount)} → ${escapeHtml(s.toName)}`);
  const receives = settlements
    .filter((s) => s.toId === playerId)
    .map((s) => `💰 ${fmt(s.amount)} ← ${escapeHtml(s.fromName)}`);
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
  const totalRestackCount = players.reduce((s, p) => s + p.restacks, 0);
  const totalRestackValue = totalRestackCount * stackValue;
  const totalFinal = players.reduce((s, p) => s + p.finalBalance, 0);
  const totalNet = players.reduce((s, p) => s + p.netPnl, 0);
  const totalRowClass = totalNet !== 0 ? 'row-total row-total-error' : 'row-total';

  body.innerHTML =
    players
      .map(
        (p) => `
    <tr data-player-id="${p.id}">
      <td class="td-name">
        <input type="text" class="cell-name" value="${escapeHtml(p.name)}" data-field="name" />
      </td>
      <td class="cell-start">${fmt(p.startBalance)}</td>
      <td class="td-restacks">
        <div class="restacks-control">
          <input type="number" class="cell-restacks" value="${p.restacks}" min="0" step="1" data-field="restacks" />
          <div class="restacks-btns">
            <button type="button" class="btn-spin btn-spin-minus" data-action="restack-minus" title="Decrease" tabindex="-1">−</button>
            <button type="button" class="btn-spin btn-spin-plus" data-action="restack-plus" title="Increase" tabindex="-1">+</button>
          </div>
        </div>
      </td>
      <td class="td-final">
        <input type="number" class="cell-final" value="${p.finalBalance}" min="0" step="1" data-field="finalBalance" />
      </td>
      <td class="cell-pnl ${pnlClass(p.netPnl)}">${p.netPnl >= 0 ? '+' : ''}${fmt(p.netPnl)}</td>
      <td class="cell-pnl cell-adjusted ${pnlClass(p.adjustedPnl)}">${p.adjustedPnl >= 0 ? '+' : ''}${fmt(p.adjustedPnl)}</td>
      <td class="cell-settlements">${settlementsForPlayer(p.id, settlements).map((line) => `<span>${line}</span>`).join('') || '—'}</td>
      <td>
        <button type="button" class="btn-remove" data-action="remove" title="Remove" tabindex="-1">×</button>
      </td>
    </tr>
  `
      )
      .join('') +
    `
    <tr class="${totalRowClass}">
      <td><strong>${players.length} player${players.length === 1 ? '' : 's'}</strong></td>
      <td class="cell-start">${fmt(totalStart)}</td>
      <td>${fmt(totalRestackValue)}</td>
      <td>${fmt(totalFinal)}</td>
      <td class="cell-pnl ${pnlClass(totalNet)}">${totalNet >= 0 ? '+' : ''}${fmt(totalNet)}</td>
      <td class="cell-pnl cell-adjusted">0</td>
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

  document.getElementById('reset')?.addEventListener('click', () => {
    app.resetToDefault();
    refresh();
  });

  gridBody()?.addEventListener('focusin', (e) => {
    const input = e.target.closest('input');
    if (input) input.select();
  });

  gridBody()?.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || e.shiftKey) return;
    const input = e.target.closest('input');
    if (!input || input.dataset?.field !== 'finalBalance') return;
    const row = input.closest('tr[data-player-id]');
    if (!row) return;
    const rows = gridBody()?.querySelectorAll('tr[data-player-id]') ?? [];
    const isLastRow = rows.length > 0 && row === rows[rows.length - 1];
    if (!isLastRow) return;
    e.preventDefault();
    app.addPlayer();
    refresh();
    const newRows = gridBody()?.querySelectorAll('tr[data-player-id]') ?? [];
    const newRow = newRows[newRows.length - 1];
    newRow?.querySelector('.cell-name')?.focus();
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
    if (btn) {
      const row = btn.closest('tr');
      const id = row?.dataset?.playerId;
      if (id) {
        app.removePlayer(id);
        refresh();
      }
      return;
    }
    const minusBtn = e.target.closest('[data-action="restack-minus"]');
    const plusBtn = e.target.closest('[data-action="restack-plus"]');
    if (minusBtn || plusBtn) {
      const row = (minusBtn || plusBtn).closest('tr');
      const id = row?.dataset?.playerId;
      if (!id) return;
      const input = row?.querySelector('.cell-restacks');
      const curr = Math.max(0, Number(input?.value || 0));
      const next = plusBtn ? curr + 1 : curr - 1;
      app.updatePlayer(id, { restacks: Math.max(0, next) });
      refresh();
    }
  });
}
