// Price-drop promotion [Q-2/P1-7, docs/specs/pdp-full-content — approved
// 2026-07-19 as an OPTIONAL additional promotion route]: a hidden deal whose
// merchant sets no compare-at price can still be a genuine deal when its OWN
// tracked price drops. Baseline = the row's max snapshotted price over the
// window; a live price ≥ DROP_PCT below that baseline proves the discount
// (regular price + lower sale price — the mandatory provenance bar).
//
// Never required for indexation [Q-1/EC-24]: compare-at-proven deals publish
// with zero history; this route only ADDS deals the compare-at path misses.
// Promotion is a LIVENESS write (visibility change) per the M2 write-class
// amendment — it bumps last_updated and (via trigger) sets first_published_at.
//
// Guardrails: window ≥ MIN_DAYS distinct snapshot days; drop ≥ DROP_PCT;
// promotions capped per run; dry-run by default.
//
//   node scripts/promote-price-drops.cjs             # dry-run
//   node scripts/promote-price-drops.cjs --apply     # write promotions
//   node scripts/promote-price-drops.cjs --drop 15 --min-days 10 --cap 200
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const APPLY = has('--apply');
const DROP_PCT = Math.max(5, parseInt(opt('--drop', '10'), 10) || 10);      // ≥5% floor — never promote noise
const MIN_DAYS = Math.max(3, parseInt(opt('--min-days', '7'), 10) || 7);    // baseline depth
const CAP = Math.max(1, parseInt(opt('--cap', '500'), 10) || 500);          // promotions per run

if (require.main === module) loadEnvLocal();
const BASE = ((process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')).replace(/^(?!https?:\/\/)/, 'https://');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IS_MAIN = require.main === module;
if ((!process.env.SUPABASE_URL || !KEY) && IS_MAIN) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'); process.exit(1); }
const SUPA = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/** Pure promotion decision [tested]: given a row's current price and its
 *  snapshot series [{day, sale_price}], return the promotion or null. */
function decidePromotion(currentPrice, series, { dropPct = DROP_PCT, minDays = MIN_DAYS } = {}) {
  const days = new Set(series.map((s) => s.day));
  if (days.size < minDays) return null;
  const baseline = Math.max(...series.map((s) => Number(s.sale_price)).filter(Number.isFinite));
  if (!Number.isFinite(baseline) || baseline <= 0) return null;
  const discount = Math.round(((baseline - currentPrice) / baseline) * 100);
  if (discount < dropPct) return null;
  return { original: Math.round(baseline * 100) / 100, discount };
}

async function page(pathAndQuery) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${BASE}/rest/v1/${pathAndQuery}`, { headers: { ...SUPA, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`read failed: HTTP ${r.status} ${await r.text()}`);
    const batch = await r.json();
    out.push(...batch);
    if (batch.length < 1000) break;
  }
  return out;
}

if (IS_MAIN) (async () => {
  const t0 = Date.now();
  // Candidates: hidden rows with 0 discount (the compare-at path found no
  // proof) — the exact population Q-2 exists for.
  const candidates = await page('deals?hidden=eq.true&discount_percent=eq.0&select=product_id,sale_price&order=product_id.asc');
  console.log(`[promote] ${candidates.length} hidden zero-discount candidates (drop≥${DROP_PCT}%, baseline≥${MIN_DAYS}d, cap ${CAP}, apply=${APPLY})`);
  if (!candidates.length) return;
  const byId = new Map(candidates.map((c) => [c.product_id, c]));

  // Snapshot series for the window, paged once and grouped client-side.
  const since = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);
  const hist = await page(`price_history?day=gte.${since}&select=product_id,day,sale_price&order=product_id.asc`);
  const series = new Map();
  for (const h of hist) {
    if (!byId.has(h.product_id)) continue;
    if (!series.has(h.product_id)) series.set(h.product_id, []);
    series.get(h.product_id).push(h);
  }

  let promoted = 0;
  const samples = [];
  for (const [id, rows] of series) {
    if (promoted >= CAP) { console.log(`[promote] cap ${CAP} reached — remaining candidates wait for the next run`); break; }
    const cand = byId.get(id);
    const current = Number(cand.sale_price);
    const p = decidePromotion(current, rows);
    if (!p) continue;
    promoted++;
    if (samples.length < 8) samples.push(`${id}: ${current} vs baseline ${p.original} (-${p.discount}%)`);
    if (APPLY) {
      // LIVENESS write: visibility + prices + last_updated (M2 amendment).
      const r = await fetch(`${BASE}/rest/v1/deals?product_id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...SUPA, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          hidden: false,
          original_price: p.original,
          discount_percent: p.discount,
          last_updated: new Date().toISOString(),
        }),
      });
      if (!r.ok) { console.error(`[promote] patch ${id}: HTTP ${r.status}`); promoted--; }
    }
  }
  // Pinned grammar for the harness/watchdog.
  console.log(`[promote] promoted=${promoted} candidates=${candidates.length} with_baseline=${series.size} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  samples.forEach((s) => console.log(`  ${s}`));
  if (!APPLY) console.log('[promote] dry-run — no writes. Re-run with --apply to commit.');
})().catch((e) => { console.error('\n[promote] FAILED:', e.message); process.exit(1); });

module.exports = { decidePromotion };

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
