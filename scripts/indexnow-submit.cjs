// IndexNow submitter — pings api.indexnow.org with deal URLs that changed
// since a cutoff, so Bing/Yandex/Seznam/Naver (and Copilot surfaces) re-crawl
// new deals and price updates within minutes instead of on sitemap cadence.
// One submission propagates to all IndexNow-participating engines. Google does
// NOT support IndexNow (2026) — its channel is the lastmod-accurate sitemap.
//
// Usage:
//   node scripts/indexnow-submit.cjs                 # deals changed in the last 3h (default)
//   node scripts/indexnow-submit.cjs --since 26      # last 26 hours
//   node scripts/indexnow-submit.cjs --all           # every deal (bootstrap / re-seed)
//   node scripts/indexnow-submit.cjs --dry-run       # build the batch, submit nothing
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   read deals via PostgREST
//   SITE_URL      default https://dealradar.me
//   INDEXNOW_KEY  default = the committed public key file (IndexNow keys are
//                 public by design — the served key file IS the ownership proof)
//
// Practices encoded (indexnow.org protocol + 2026 guides):
//   - submit ONLY changed URLs (never blanket-resubmit unchanged content)
//   - batch POST (protocol cap 10,000/request) instead of per-URL GETs
//   - include hidden/delisted deals: engines re-crawl, see the 404, and drop
//     the stale listing — freshness works in both directions
//   - canonical (default-locale) URL only; hreflang alternates are discovered
//     from the page/sitemap, not pinged individually

const SITE = (process.env.SITE_URL || 'https://dealradar.me').replace(/\/+$/, '');
const KEY = process.env.INDEXNOW_KEY || '36c4f6d24ff2c383742acbda6243bb20';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const BATCH_MAX = 10000;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

async function changedDeals(sinceIso) {
  if (!SUPABASE_URL || !SRK) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const rows = [];
  const PAGE = 1000; // PostgREST max-rows cap — page explicitly
  for (let from = 0; ; from += PAGE) {
    const filter = sinceIso ? `&last_updated=gte.${encodeURIComponent(sinceIso)}` : '';
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/deals?select=slug,hidden,last_updated${filter}&order=slug.asc`,
      {
        headers: {
          apikey: SRK,
          Authorization: `Bearer ${SRK}`,
          Range: `${from}-${from + PAGE - 1}`,
        },
      },
    );
    if (!res.ok) throw new Error(`PostgREST ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

async function submit(urls) {
  let accepted = 0;
  for (let i = 0; i < urls.length; i += BATCH_MAX) {
    const batch = urls.slice(i, i + BATCH_MAX);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: new URL(SITE).host,
        key: KEY,
        keyLocation: `${SITE}/${KEY}.txt`,
        urlList: batch,
      }),
    });
    // 200 = OK, 202 = accepted (key validation pending) — both are success.
    if (res.status === 200 || res.status === 202) {
      accepted += batch.length;
      console.log(`[indexnow] batch of ${batch.length} accepted (HTTP ${res.status})`);
    } else {
      throw new Error(`IndexNow rejected batch: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
  }
  return accepted;
}

(async () => {
  const all = flag('--all');
  const hours = Number(opt('--since', '3'));
  const sinceIso = all ? null : new Date(Date.now() - hours * 3600e3).toISOString();

  const rows = await changedDeals(sinceIso);
  const urls = rows.map((r) => `${SITE}/en/deal/${r.slug}`);
  // Homepage content shifts with every ingest — ping it alongside any change.
  if (urls.length > 0) urls.push(`${SITE}/en`);

  const hidden = rows.filter((r) => r.hidden).length;
  console.log(
    `[indexnow] ${all ? 'ALL deals' : `changed since ${sinceIso}`}: ${rows.length} deals ` +
      `(${hidden} hidden → 404 refresh) → ${urls.length} URLs`,
  );
  if (urls.length === 0) {
    console.log('[indexnow] nothing changed — no submission (protocol: only ping real changes).');
    return;
  }
  if (flag('--dry-run')) {
    console.log('[indexnow] dry-run — first 3 URLs:', urls.slice(0, 3));
    return;
  }
  const n = await submit(urls);
  console.log(`[indexnow] DONE — ${n} URLs submitted to ${ENDPOINT} (propagates to all IndexNow engines).`);
})().catch((e) => {
  console.error(`[indexnow] FAILED: ${e.message}`);
  process.exit(1);
});
