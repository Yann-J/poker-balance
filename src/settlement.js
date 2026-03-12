/**
 * Compute optimal settlements that minimize the number of transfers.
 * Uses greedy min-cash-flow: match highest debtor with highest creditor.
 * @param {Record<string, number>} netByPlayerId - net balance per player (positive = owed, negative = owes)
 * @returns {{ fromId: string, toId: string, amount: number }[]}
 */
export function computeSettlement(netByPlayerId) {
  const entries = Object.entries(netByPlayerId).filter(
    ([, net]) => net !== 0
  );
  if (entries.length === 0) return [];

  const debtors = entries
    .filter(([, net]) => net < 0)
    .map(([id, net]) => ({ id, amount: Math.abs(net) }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = entries
    .filter(([, net]) => net > 0)
    .map(([id, net]) => ({ id, amount: net }))
    .sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = Math.min(d.amount, c.amount);
    transfers.push({ fromId: d.id, toId: c.id, amount });

    d.amount -= amount;
    c.amount -= amount;
    if (d.amount === 0) i++;
    if (c.amount === 0) j++;
  }

  return transfers;
}
