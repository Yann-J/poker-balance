import { describe, it, expect } from 'vitest';
import { computeSettlement } from '../src/settlement.js';

describe('computeSettlement', () => {
  it('returns empty array when all nets are zero', () => {
    expect(computeSettlement({ a: 0, b: 0 })).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(computeSettlement({})).toEqual([]);
  });

  it('settles two players: one debtor, one creditor', () => {
    const result = computeSettlement({ alice: 50, bob: -50 });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ fromId: 'bob', toId: 'alice', amount: 50 });
  });

  it('settles three players with single transfer path', () => {
    // alice +100, bob -50, charlie -50 => bob pays alice 50, charlie pays alice 50
    const result = computeSettlement({ alice: 100, bob: -50, charlie: -50 });
    expect(result).toHaveLength(2);
    const amounts = result.map((r) => r.amount);
    expect(amounts.sort()).toEqual([50, 50]);
    const toAlice = result.filter((r) => r.toId === 'alice');
    expect(toAlice).toHaveLength(2);
  });

  it('uses at most n-1 transfers', () => {
    const nets = { a: 100, b: -30, c: -40, d: -30 };
    const result = computeSettlement(nets);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('preserves total flow (sum of transfers equals sum of positive nets)', () => {
    const nets = { a: 100, b: -60, c: -40 };
    const result = computeSettlement(nets);
    const totalTransferred = result.reduce((s, t) => s + t.amount, 0);
    const totalCredit = Object.values(nets).filter((n) => n > 0).reduce((s, n) => s + n, 0);
    expect(totalTransferred).toBe(totalCredit);
  });

  it('settles all debts (no remainder)', () => {
    const nets = { a: 50, b: -25, c: -25 };
    const result = computeSettlement(nets);
    const byPlayer = {};
    for (const t of result) {
      byPlayer[t.fromId] = (byPlayer[t.fromId] ?? 0) - t.amount;
      byPlayer[t.toId] = (byPlayer[t.toId] ?? 0) + t.amount;
    }
    for (const [id, net] of Object.entries(nets)) {
      expect(byPlayer[id] ?? 0).toBe(net);
    }
  });
});
