# Ingest-v2 (AWIN Google-format feeds) — findings (Pass 1: codebase + prior evidence)

**Date:** 2026-07-16 · **Goal (user):** 100% of joined advertisers' products populated AND indexed — categories, tags, filtration, nested pages, internal linking, sitemaps, network pings.

## The gap (verified 2026-07-15, refresh pending in Pass 2)

- The nightly feed is legacy-format only: the Create-a-Feed URL carries `hasEnhancedFeeds/0`, and AWIN documents that **Google-format feeds are not selectable via Category/Brand selectors** (docs brief, workflow output 2026-07-15). Category-based = our current scope.
- Feed-list audit (publisher 2951525): 917 feed rows network-visible, **310 already Google-format (34%)**. Of active memberships then: 4 advertisers were Google-format-ONLY — Renogy DE (724 products), ANTHBOT DE (165), Welax DE (165), Omidi DE (64) = **1,118 products from joined programmes contributing zero pages**. User reports more joins since; Pass 2 re-pulls the feed list.
- All NEW retail advertisers join in Google format — the gap grows monotonically. The AWIN autonomy pipeline (Tier 1+2 joins) keeps recommending programmes whose products can never arrive via ingest-v1.

## Current pipeline (ingest-v1) — what v2 must slot into

| Stage | Mechanism | Scale assumptions found |
|---|---|---|
| Acquisition | `AWIN_FEED_URL` secret → one gzip CSV, cron 03:00 UTC (`.github/workflows/ingest-awin.yml`, dry_run input) | Streams; 193k rows in 49s — fine |
| Parse/normalize | `scripts/ingest-awin.cjs` RFC-4180 stream parser; reads ~30 columns BY HEADER NAME (`normalizeRow`, lines 120-177) | Column names are legacy AWIN; **no code path understands Google attribute names** |
| Deal gate | in_stock=1, EUR, `original > sale`, discount>0 (`ingest-awin.cjs:121-133`) | 193,662 rows → **819 deals (0.4%)** — the discount gate, not the feed, bounds catalog size |
| Identity | `product_id = awin:${aw_product_id}` (line 151); slug = `slugify(name)-productId` (`deals.repo.ts:27`) | **Google format has NO `aw_product_id`** (docs brief: rekey as `advertiser_id` + `id`) — identity scheme must extend; interacts with M2 URL/slug spec's locked freeze-after-mint decision |
| Category | `mapCategory(category_name, merchant_category)` hand-curated string map + name overrides (`ingest-awin.cjs:111,160`) | Google format ships `google_product_category` (**English taxonomy**) + `product_type` — unmapped today |
| Prices | `search_price` + `rrp_price`/`product_price_old` → discount | Google format: `price` = base, `sale_price` = deal price, both as `"15.00 EUR"` strings — **was-price semantics inverted**, currency embedded |
| Images | `aw_image_url` + `large_image` + 4 alternates → gallery | Google: single `image_link` + `additional_image_link` as JSON array |
| Post-ingest daily jobs | verify-awin.cjs (fetches EVERY deal's merchant page, 1s/host pacing), enrich-galleries.cjs, snapshot-prices.cjs (1 row/deal/day), flag-homepage-hidden | Linear per-deal cost — fine at ~1k deals, breaks at 10k+ (Actions window), impossible at 100k+ |
| Publication | force-dynamic PDPs/lists; sitemap index → `deals-N.xml` × 500/chunk via `getAllDealSlugs()` (paged, hidden-filtered, `deals.repo.ts:344-362`); IndexNow on ingest/verify; robots facet-traps configured | Sitemap chunking auto-scales; but each sitemap request re-scans all slugs (no cache), `RANDOM_POOL_MAX=1000` caps homepage shuffle pool, Netlify per-request functions (yesterday's `usage_exceeded` outage) |
| Internal linking | Breadcrumbs (Home›category), `matchSubCategory` name-matching → subcategory search links, category menu tree | Purely name/category-driven — works for any volume, quality depends on category mapping |

## What "100% populated and indexed" forces us to decide

1. **Product model — the big one.** The discount gate keeps only genuine deals (0.4% of feed rows yesterday). "100% of their products" literally means dropping/loosening that gate → catalog jumps from ~850 to ~200k+ pages. That's a different product (price-comparison catalog vs deals site), different capacity envelope (Supabase rows, price_history 200k rows/DAY, verifier impossibility, Netlify usage), and different SEO profile (200k thin-ish PDPs vs curated deals). Alternatives: (a) keep deals-only but 100% ADVERTISER coverage (every joined programme's discounted products), (b) all-products, (c) tiered — deals get full PDPs, non-discounted products get lighter listing treatment or price-alert-only pages. **User decision at the gate.**
2. **Identity/URL scheme for enhanced rows** must not violate the M2 slug spec's locked decisions (freeze-after-mint, public_id) — Pass 2 reads the spec for constraints.
3. **Coverage watchdog**: "ensure 100%" needs continuous proof, not a one-time fix — join `affiliate_programmes` (Tier-1 sync) with feed-list format flags + per-advertiser ingested counts; alert on any joined advertiser with 0 products.

## Acquisition options for Google-format feeds (Pass 2 settles empirically)

- **A. Feed-list-driven downloads** — the feed list CSV (already used 2026-07-15) has per-feed `URL` + `Datafeed Format` + `Membership Status` columns: enumerate active feeds, download each, dispatch to per-format parser. No UI dependency; new joins auto-appear. *Leading candidate.*
- **B. Advertiser-based Create-a-Feed** — supports Google-format advertisers but freezes an explicit advertiser list in the URL (defeats auto-inclusion) and output schema for mixed selections is undocumented.
- **C. Publisher/Partner Feed API** — documented to serve all enhanced feeds; auth/quotas/formats unknown → Pass 2 docs read.

## Pass 2 enrichment (2026-07-16: live probes + API docs + M2 spec — 4 parallel agents)

### Fresh quantification (live feed-list, 2026-07-16)

- **13 active advertisers** (17 feed rows; up from 8 rows on 07-15). **8 are Google-format-only**: Renogy DE (724 across GBP+EUR feeds), Hollyland DE (455), MISSHA US (270, USD), ANTHBOT DE (165), Welax DE (165), AOSU DA (116), Omidi DE (64), Autofull EU (32) — **1,991 products invisible to ingest-v1**. The 4 new ones are exactly the pending invitations accepted since.
- **ROCKBROS is dual-format**: Google feed 5,109 products (fresh) vs legacy feed 5,456 (STALE since 2026-05-15) — for dual-format advertisers the Google feed is the fresher source.
- Legacy-format actives include feeds the nightly `language/de` scope excludes: logo-matten DE 71,538 (English), Babubas NL/UK 8,863+8,267 (Dutch/English). And the nightly feed's top merchants (Blitec 71k, Modellbau-Universe 49k…) don't appear in the feed list's actives at all (soft membership). **"100% coverage" therefore needs reconciliation across three sets that don't match today: feed-list actives × nightly-feed merchants × DB catalog.**
- Feed-list `Membership Status` has exactly two values (`active`/`Not Joined`) — pending/invited states are not visible there.

### 🔴 The decisive empirical finding: Google feeds carry ZERO discount signal

All **10** active Google-format feeds were downloaded and scanned: **`sale_price` is empty in every one of the 7,100 rows** (ROCKBROS 5,109; Hollyland 455; Renogy 426+298; MISSHA 270; ANTHBOT 165; Welax 165; AOSU 116; Omidi 64; Autofull 32). Under the current deal gate (needs original > sale), **a Google-format parser alone yields a catalog of exactly 0** from these advertisers. "100% populated" is impossible on feed signal alone; it requires either (a) derived discounts — daily `price_history` baselines and/or the live-shop verifier reading Shopify compare-at prices (machinery that already exists) — or (b) a catalog-scope change (all-products / tiered pages).

### Empirical schema (settles Pass-1 unknowns)

- The feed-list per-feed URLs serve Google-format feeds as **plain CSV** (not JSONL) downloadable with the **existing legacy feed API key** — acquisition path A works for both formats with one credential. 62 columns, byte-identical header across all 10 feeds, UTF-8 **with BOM**, comma, LF, RFC-4180 quoting.
- Key cells: `price` = `"26.99 EUR"` (value+ISO code in one string); `availability` = `in_stock`/`out_of_stock` (Hollyland is 67% out-of-stock — v1 would drop those; a product-page model may keep them as "unavailable"); `aw_deep_link` **populated** (monetization intact); `additional_image_link`, `shipping`, `item_group_id`, `product_type` all **empty in practice** (galleries must come from `image_link` + the existing merchant-page enrich job); `google_product_category` is a **text taxonomy path**, not numeric; ids are Shopify variant IDs; `gtin` well-filled; energy/certification columns exist but were not sampled non-empty.
- Currencies are single-valued per feed; Renogy-GB (GBP) and MISSHA (USD) fail the EUR gate even after format support → currency/market policy needed.

### Feed API (alternative acquisition; docs verified)

`GET api.awin.com/publishers/{id}/awinfeeds/download/{advertiserId}-retail-{locale}` — **enhanced feeds only**, JSONL, OAuth2 Bearer using the **existing `AWIN_API_TOKEN`**; ≤5 req/min per feed, no concurrent requests, 20 calls/min global; feed-enumeration list call referenced in the FAQ but undocumented. Legacy feeds are NOT served by this API. Verdict: optional redundancy; the feed-list CSV route is simpler and format-agnostic. No legacy-feed sunset date exists anywhere in the docs.

### M2 URL/slug spec constraints (binding — locked decisions)

- **D3 makes Pass-1's proposed namespace non-compliant**: every provider must mint `{provider}:{COUNTRY}:{id}`. Compliant shape: **`awin:{COUNTRY}:adv{advertiser_id}:{merchant_product_id}`** (distinguishable tail so it can never collide with classic `aw_product_id` tails). Namespace chosen at first prod insert is **permanent** (public_id = frozen md5 of product_id).
- **Sequencing**: never launch un-countried and re-key later (the one non-negotiable). Clean option = launch after M2 Phase D (ingest sends no slug at all); allowed = launch pre-Phase-B **with the final countried namespace from day one**, accepting that those rows carry legacy 308-slugs through the migration like all existing rows. Coordinate with M2 task **C8**, which already owns rewriting `ingest-awin.cjs` to countried ids.
- **Writer contract** (applies regardless of timing): always send fresh `last_updated`; never send `status`/`expired_at`/`content_changed_at`; ship a run-id watermark, skip-if-last-run-failed, >10% expiry tripwire, failure alerting (spec.md:113-124).
- Unstable upstream ids gate the SOURCE's launch (spec.md:243) — Shopify variant IDs are stable in practice but per-advertiser id churn must be monitored; id churn = new URL + expired old page by design.
- Scale rule: sitemap sharding to 4096 shards before `active × 13 locales / 256` nears 50k; Phase-E crawl-budget re-measurement required for any large inventory addition.
