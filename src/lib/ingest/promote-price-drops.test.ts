// Q-2/P1-7 — pure promotion decision guardrails.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { decidePromotion } = require('../../../scripts/promote-price-drops.cjs');

const series = (prices: number[]) => prices.map((p, i) => ({ day: `2026-07-${String(i + 1).padStart(2, '0')}`, sale_price: p }));

describe('decidePromotion', () => {
  it('promotes a ≥10% drop against a ≥7-day baseline', () => {
    const p = decidePromotion(89.99, series([100, 100, 100, 100, 100, 100, 100]));
    expect(p).toEqual({ original: 100, discount: 10 });
  });

  it('never promotes on a thin baseline (<7 distinct days)', () => {
    expect(decidePromotion(50, series([100, 100, 100]))).toBeNull();
  });

  it('never promotes noise (<10% drop)', () => {
    expect(decidePromotion(95, series([100, 100, 100, 100, 100, 100, 100]))).toBeNull();
  });

  it('baseline is the window MAX — a briefly-raised price cannot fake a deal', () => {
    // Price sat at 50, spiked to 60 once, now 50: only a 17% drop vs max 60
    // would promote — 50 vs 60 is 17%… guard: current 55 vs max 60 = 8% → null.
    expect(decidePromotion(55, series([50, 50, 60, 50, 50, 50, 50]))).toBeNull();
  });

  it('duplicate days do not inflate the baseline depth', () => {
    const dup = [...series([100, 100, 100]), ...series([100, 100, 100])];
    expect(decidePromotion(80, dup)).toBeNull();
  });
});
