# Task Checklist: DealRadar Live Integration & GEO

This checklist breaks down the transition of DealRadar to the live Strackr API, GEO setup, sitemaps, edge middleware, and postbacks into granular, sequence-ordered development tasks.

---

## Phase 1: Database Schema Migration
- [ ] **Task 1.1: Add schema updates to script**
  - *Action:* Append new tracking and SEO columns (`affiliate_network`, `merchant_name`, `native_product_id`, `ean_code`, `tracking_url`, `description`, `historical_low_price`, `slug`) to the `deals` table in `supabase/schema.sql`.
  - *Verification:* View `supabase/schema.sql` and verify syntax correctness.
- [ ] **Task 1.2: Execute database schema migrations**
  - *Action:* Run the migration statements on the active Supabase PostgreSQL database.
  - *Verification:* Run a `psql` column check command (e.g. `\d deals`) to confirm all new columns are present.
- [ ] **Task 1.3: Apply database constraints**
  - *Action:* Execute SQL statements adding unique constraints: `unique_deal_per_network` on `(affiliate_network, native_product_id)` and `unique_deal_slug` on `(slug)`.
  - *Verification:* Execute a query on `information_schema.table_constraints` to verify both constraints are registered.
- [ ] **Task 1.4: Create database indices**
  - *Action:* Create database search indices on the `slug` and `ean_code` columns.
  - *Verification:* Query `pg_indexes` to verify that `deals_slug_idx` and `deals_ean_idx` indices exist.

---

## Phase 2: Core Types & Helpers
- [ ] **Task 2.1: Implement slug utility**
  - *Action:* Create the utility `src/lib/utils/slug.ts` with a `slugify()` function that converts arbitrary strings to lowercase, diacritic-free, hyphenated tokens.
  - *Verification:* Run a temporary script in the terminal `node -e "console.log(require('./src/lib/utils/slug').slugify('Test Product 123!'))"` and assert it outputs `test-product-123`.
- [ ] **Task 2.2: Extend NormalizedDeal interface**
  - *Action:* Add `affiliateNetwork`, `merchantName`, `nativeProductId`, `eanCode`, `trackingUrl`, `description`, `historicalLowPrice`, and `slug` optional fields to `NormalizedDeal` in `src/lib/providers/types.ts`.
  - *Verification:* Run `pnpm tsc --noEmit` to confirm the compiler parses the updated interface.

---

## Phase 3: Repository Logic Updates
- [ ] **Task 3.1: Update mapping helpers**
  - *Action:* Modify `toRow` and `fromRow` in `src/lib/db/deals.repo.ts` to translate between database snake_case and interface camelCase variables.
  - *Verification:* Run `pnpm tsc --noEmit` and check for mapper syntax errors.
- [ ] **Task 3.2: Implement slug detail lookup**
  - *Action:* Implement `getDealBySlug(slug: string): Promise<NormalizedDeal | null>` inside `src/lib/db/deals.repo.ts`.
  - *Verification:* Run a test script attempting to query an existing slug and validating the return shape.
- [ ] **Task 3.3: Implement historical price check & slug generation in upsert**
  - *Action:* Update `upsertDeals` to read database records matching target `productId`s, compute the lower of previous `historical_low_price` vs. current price, generate unique slugs, and perform the upsert.
  - *Verification:* Verify that calling `upsertDeals` on mock objects stores them with computed slugs and correct historical baselines.

---

## Phase 4: Strackr Provider Integration
- [ ] **Task 4.1: Create Strackr provider file**
  - *Action:* Create `src/lib/providers/strackr.ts` implementing `PriceProvider`. Implement the `/v3/offers` HTTP query in live mode, and fall back to mock data generator in dev mode.
  - *Verification:* Run `pnpm tsc --noEmit` to ensure the class conforms perfectly to `PriceProvider`.
- [ ] **Task 4.2: Register Strackr provider**
  - *Action:* Add `StrackrProvider` to the `ALL_PROVIDERS` registry in `src/lib/providers/registry.ts`.
  - *Verification:* Verify `initProviders()` logs initial mock warnings when `STRACKR_API_KEY` is missing in dev mode.

---

## Phase 5: Geolocation Edge Middleware
- [ ] **Task 5.1: Create edge geolocation resolver**
  - *Action:* Update `src/middleware.ts` to inspect incoming headers (`x-nf-country`, `x-vercel-ip-country`) and set the `dr_location` cookie on first load if it is absent.
  - *Verification:* Start dev server via `pnpm dev`, curl localhost passing headers, and inspect response headers for `Set-Cookie: dr_location=...`.

---

## Phase 6: Pages, Routing, & GEO markups
- [ ] **Task 6.1: Create SSR Deal Details page**
  - *Action:* Build `src/app/[locale]/deal/[slug]/page.tsx` retrieving the deal via `getDealBySlug`, outputting alternate canonical links, rendering metadata, JSON-LD structure, and proof sections.
  - *Verification:* Navigate to `/[locale]/deal/[slug]` and view HTML source to inspect injected script blocks.
- [ ] **Task 6.2: Link cards to detail paths**
  - *Action:* Modify `src/components/deals/DealCard.tsx` to set the card anchor link to `/[locale]/deal/[slug]`.
  - *Verification:* Click a deal card on the homepage grid and verify it triggers Next.js router transition to the new path.
- [ ] **Task 6.3: Implement dynamic sitemap endpoint**
  - *Action:* Create `src/app/[locale]/sitemap.xml/route.ts` which selects active deal slugs from the database and returns a valid XML sitemap.
  - *Verification:* Curl `/en/sitemap.xml` and verify it serves well-formed XML content.
- [ ] **Task 6.4: Add robots.txt configuration**
  - *Action:* Create `public/robots.txt` with allowance rules for AI bots (`OAI-SearchBot`, `PerplexityBot`, etc.) and exclusions for API paths.
  - *Verification:* Navigate to `/robots.txt` on the running instance and verify content matches.

---

## Phase 7: Webhook Postbacks
- [ ] **Task 7.1: Implement postback route**
  - *Action:* Create the serverless route `src/app/api/postbacks/route.ts` parsing webhook payouts and updating the respective database records.
  - *Verification:* Trigger mock webhook POST payload via curl and verify commission changes in database.

---

## Phase 8: Compilation & Validation
- [ ] **Task 8.1: Run production build**
  - *Action:* Run Next.js production build command.
  - *Verification:* Execute `pnpm build` (or `npm run build`) and verify build compiles with zero errors.
