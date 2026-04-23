import * as app from './main.js';
const stackInput = () => document.getElementById('stack-value');
const addBtn = () => document.getElementById('add-player');
const copyImageBtn = () => document.getElementById('copy-table-image');
const gridBody = () => document.getElementById('grid-body');
let draggedPlayerId = null;

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
      <td class="td-drag">
        <button type="button" class="btn-drag" data-action="drag-handle" draggable="true" title="Drag to reorder" aria-label="Drag ${escapeHtml(p.name)} to reorder">⋮⋮</button>
      </td>
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
      <td></td>
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

function clearDropTargets() {
  gridBody()?.querySelectorAll('tr.drop-target').forEach((row) => row.classList.remove('drop-target'));
}

function readCellText(cell) {
  const input = cell.querySelector('input');
  if (input) return (input.value || '').trim() || '—';
  const text = (cell.textContent || '').replace(/\s+/g, ' ').trim();
  return text || '—';
}

function buildTableSnapshot() {
  const table = document.querySelector('.grid');
  if (!table) return null;

  const sourceRows = Array.from(table.querySelectorAll('tr'))
    .map((row) => {
      const cells = Array.from(row.children).slice(1, -1);
      if (!cells.length) return null;
      return {
        cells: cells.map((cell) => ({
          text: readCellText(cell),
          className: cell.className,
        })),
        className: row.className,
      };
    })
    .filter(Boolean);

  if (!sourceRows.length) return null;

  const firstRowCells = Array.from(table.querySelector('tr')?.children || []).slice(1, -1);
  if (!firstRowCells.length) return null;

  const colWidths = firstRowCells.map((cell) => Math.max(60, Math.ceil(cell.getBoundingClientRect().width)));
  return { rows: sourceRows, colWidths };
}

async function tablePngBlob() {
  const snapshot = buildTableSnapshot();
  if (!snapshot) return null;

  const cellPaddingX = 10;
  const rowHeight = 36;
  const borderColor = '#30363d';
  const textColor = '#e6edf3';
  const mutedTextColor = '#8b949e';
  const winColor = '#3fb950';
  const lossColor = '#f85149';
  const bgColor = '#0d1117';
  const tableBgColor = '#161b22';
  const headBgColor = 'rgba(0, 0, 0, 0.2)';
  const totalBgColor = 'rgba(0, 0, 0, 0.15)';

  const width = snapshot.colWidths.reduce((sum, colWidth) => sum + colWidth, 0);
  const height = snapshot.rows.length * rowHeight;
  const padding = 12;
  const ratio = Math.max(1, Math.floor(window.devicePixelRatio || 1));

  const canvas = document.createElement('canvas');
  canvas.width = (width + (padding * 2)) * ratio;
  canvas.height = (height + (padding * 2)) * ratio;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(ratio, ratio);

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width + (padding * 2), height + (padding * 2));
  ctx.fillStyle = tableBgColor;
  ctx.fillRect(padding, padding, width, height);

  ctx.textBaseline = 'middle';
  ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  let y = padding;
  snapshot.rows.forEach((row, rowIndex) => {
    const rowIsHeader = rowIndex === 0;
    const rowIsTotal = row.className.includes('row-total');
    if (rowIsHeader) {
      ctx.fillStyle = headBgColor;
      ctx.fillRect(padding, y, width, rowHeight);
    } else if (rowIsTotal) {
      ctx.fillStyle = totalBgColor;
      ctx.fillRect(padding, y, width, rowHeight);
    }

    let x = padding;
    row.cells.forEach((cell, colIndex) => {
      const colWidth = snapshot.colWidths[colIndex];
      const alignRight = cell.className.includes('cell-pnl')
        || cell.className.includes('cell-restacks')
        || cell.className.includes('cell-final');

      if (rowIsHeader) ctx.fillStyle = mutedTextColor;
      else if (cell.className.includes('pnl-win')) ctx.fillStyle = winColor;
      else if (cell.className.includes('pnl-loss')) ctx.fillStyle = lossColor;
      else ctx.fillStyle = textColor;

      ctx.textAlign = alignRight ? 'right' : 'left';
      const textX = alignRight ? x + colWidth - cellPaddingX : x + cellPaddingX;
      const textY = y + (rowHeight / 2);
      ctx.fillText(cell.text, textX, textY);

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, colWidth, rowHeight);
      x += colWidth;
    });
    y += rowHeight;
  });

  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
}

async function copyTableImage() {
  const blob = await tablePngBlob();
  if (!blob) throw new Error('Could not generate table image.');

  const clipboardAvailable = !!(
    navigator.clipboard
    && window.ClipboardItem
    && typeof navigator.clipboard.write === 'function'
  );

  if (clipboardAvailable) {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return 'copied';
  }

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'poker-balance-table.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  return 'downloaded';
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

  copyImageBtn()?.addEventListener('click', async (e) => {
    const button = e.currentTarget;
    if (!(button instanceof HTMLButtonElement)) return;
    const initialLabel = button.textContent;
    button.disabled = true;
    try {
      const result = await copyTableImage();
      button.textContent = result === 'copied' ? 'Copied image' : 'Downloaded image';
    } catch {
      button.textContent = 'Copy failed';
    } finally {
      setTimeout(() => {
        button.textContent = initialLabel;
        button.disabled = false;
      }, 1200);
    }
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

  gridBody()?.addEventListener('dragstart', (e) => {
    const handle = e.target.closest('[data-action="drag-handle"]');
    if (!handle) return;
    const row = handle.closest('tr[data-player-id]');
    const id = row?.dataset?.playerId;
    if (!id) return;
    draggedPlayerId = id;
    row?.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    }
  });

  gridBody()?.addEventListener('dragover', (e) => {
    if (!draggedPlayerId) return;
    const row = e.target.closest('tr[data-player-id]');
    if (!row || row.dataset.playerId === draggedPlayerId) return;
    e.preventDefault();
    clearDropTargets();
    row.classList.add('drop-target');
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  });

  gridBody()?.addEventListener('drop', (e) => {
    if (!draggedPlayerId) return;
    const row = e.target.closest('tr[data-player-id]');
    const targetId = row?.dataset?.playerId;
    if (!targetId || targetId === draggedPlayerId) return;
    e.preventDefault();
    app.reorderPlayers(draggedPlayerId, targetId);
    draggedPlayerId = null;
    clearDropTargets();
    refresh();
  });

  gridBody()?.addEventListener('dragend', () => {
    gridBody()?.querySelectorAll('tr.dragging').forEach((row) => row.classList.remove('dragging'));
    draggedPlayerId = null;
    clearDropTargets();
  });
}
