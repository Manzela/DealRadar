# Design Blueprint: DealRadar Live Integration & GEO Optimization

This document serves as the design specification for integrating the live Strackr API, implementing the GEO (Generative Engine Optimization) knowledge graph, updating the database schemas, and adding geolocation edge middleware.

---

## 1. Architecture & Component Structure

We will extend the existing provider and repository patterns to support the new features, keeping all modules clean, typed, and backwards-compatible.

### File Organization & Directory Layout

```
DealRadar/
├── supabase/
│   └── schema.sql                  <-- [MODIFY] Append new table migrations, unique constraints, and indices
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── deal/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx    <-- [NEW] SSR deal page with JSON-LD and AI proof anchors
│   │   │   └── sitemap.xml/
│   │   │       └── route.ts        <-- [NEW] Dynamic sitemap generator endpoint
│   │   └── api/
│   │       └── postbacks/
│   │           └── route.ts        <-- [NEW] Serverless transaction postback handler
│   ├── components/
│   │   └── deals/
│   │       └── DealCard.tsx        <-- [MODIFY] Point to the new SSR deal details page instead of opening a modal
│   ├── lib/
│   │   ├── db/
│   │   │   └── deals.repo.ts       <-- [MODIFY] Add getDealBySlug(), update queryDeals() and upsertDeals() with historical low price and slug tracking
│   │   ├── providers/
│   │   │   ├── strackr.ts          <-- [NEW] Live Strackr PriceProvider integration
│   │   │   ├── registry.ts         <-- [MODIFY] Register Strackr provider with high priority
│   │   │   └── types.ts            <-- [MODIFY] Update NormalizedDeal types to include new tracking fields
│   │   └── utils/
│   │       └── slug.ts             <-- [NEW] Clean, URL-safe slug generator helper
│   ├── middleware.ts               <-- [MODIFY] Wrap intlMiddleware to parse geo-headers and set response cookie
│   └── public/
│       └── robots.txt              <-- [NEW] AI crawler allowances and API exclusion rules
```

---

## 2. Data Schemas

### Database Schema Migration (`supabase/schema.sql`)

The existing `deals` table will be modified to support advanced deduplication, tracking, historical price tracking, and SEO slugs.

```sql
-- Database Migration (incremental updates)
ALTER TABLE public.deals 
  ADD COLUMN IF NOT EXISTS affiliate_network varchar(50),
  ADD COLUMN IF NOT EXISTS merchant_name varchar(100),
  ADD COLUMN IF NOT EXISTS native_product_id varchar(100),
  ADD COLUMN IF NOT EXISTS ean_code varchar(20),
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS historical_low_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS slug text;

-- Generate slugs for any existing records using their product_name and product_id
UPDATE public.deals 
SET slug = lower(regexp_replace(product_name, '[^a-zA-Z0-9\s-]', '', 'g')) || '-' || replace(product_id, ':', '-')
WHERE slug IS NULL;

-- Enforce UNIQUE on slug so they are safe lookup keys
ALTER TABLE public.deals 
  ALTER COLUMN slug SET NOT NULL,
  ADD CONSTRAINT unique_deal_slug UNIQUE (slug);

-- Add unique constraint for (affiliate_network, native_product_id) to match Step 1 of PRD
ALTER TABLE public.deals
  ADD CONSTRAINT unique_deal_per_network UNIQUE (affiliate_network, native_product_id);

-- Indexing for fast lookups
CREATE INDEX IF NOT EXISTS deals_slug_idx ON public.deals (slug);
CREATE INDEX IF NOT EXISTS deals_ean_idx ON public.deals (ean_code) WHERE ean_code IS NOT NULL;
```

### TypeScript Data Model (`src/lib/providers/types.ts`)

We will update the `NormalizedDeal` interface to include the new fields.

```typescript
export interface NormalizedDeal {
  // Existing fields
  productId: string;
  productName: string;
  shopName: string;
  shopUrl: string;
  shopLogoUrl: string | null;
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  currency: string;
  category: CategorySlug;
  brand: string | null;
  imageUrl: string | null;
  country: CountryCode;
  city: string | null;
  isSponsored: boolean;
  source: string;
  lastUpdated: string;

  // New tracking and GEO fields
  affiliateNetwork?: string;
  merchantName?: string;
  nativeProductId?: string;
  eanCode?: string | null;
  trackingUrl?: string;
  description?: string | null;
  historicalLowPrice?: number | null;
  slug?: string;
}
```

---

## 3. API Contracts

### Live Strackr Deals Fetch Payload (Incoming JSON)
* **Endpoint:** `https://api.strackr.com/v3/offers` (configured via `STRACKR_API_URL` env var)
* **Auth Header:** `Authorization: Bearer $STRACKR_API_KEY`
* **Response payload contract:**
```json
{
  "results": [
    {
      "id": "129849",
      "name": "Samsung Galaxy S24 Ultra",
      "description": "256GB Titan Black. Free shipping.",
      "image": "https://images.affiliatecdn.com/samsung-s24.jpg",
      "url": "https://track.awin.com/click?merchant=123&subid1=DE&subid2=electronics&subid3=strackr:129849",
      "merchant": { "name": "Samsung DE" },
      "network": "awin",
      "prices": {
        "price": 1049.00,
        "old_price": 1449.00,
        "discount_percent": 27.6
      },
      "extra": {
        "ean": "8806095304725"
      }
    }
  ]
}
```

### Transaction Postback Listener API (Outgoing Webhook)
* **Endpoint:** `POST /api/postbacks`
* **Payload contract:**
```json
{
  "transaction_id": "tx_abc123",
  "commission_earned": 52.45,
  "status": "pending",
  "subid3": "strackr:129849"
}
```
* **Success Response:** `200 OK` -> `{ "ok": true }`
* **Error Response:** `400 Bad Request` -> `{ "error": "missing_transaction" }`

---

## 4. Conflict Mitigation & Design Decisions

### Modal vs. Static Page Routing
* **Conflict:** The existing UI utilizes client-side React modals (`DealDetailModal.tsx`) when clicking a deal card. Generative AI scrapers and search bots cannot index modals triggered by button click states.
* **Resolution:** We will implement static page routing under `/deal/[slug]/page.tsx`. When a user clicks a deal card:
  1. If they click "Go to deal" or open new tabs, they are routed cleanly.
  2. The `DealCard` title/image links will navigate to standard `/[locale]/deal/[slug]` instead of triggering React local state `open = true`. This optimizes canonical search results and ensures search engine bots crawl a dedicated static route.

### Slug Uniqueness
* **Decision:** Slugs will be generated automatically as `${slugify(deal.productName)}-${deal.productId.replace(':', '-')}` to guarantee uniqueness and prevent collision errors on identical item titles across different merchants.

### Database Row Reconciliation
* **Decision:** We will continue to use `product_id` as the primary key. Since `product_id` is a composite of `provider:id` (e.g. `strackr:129849`), it naturally fulfills the uniqueness requirements of `unique_deal_per_network`.

### Ingest Deduplication Keep-Deepest Strategy
* **Decision:** If two networks expose the exact same EAN or slug-key, we will inspect the `discountPercent` values. The pipeline will keep the deal offering the highest discount, updating the DB record. If discounts are identical, the registry prioritizes the record that is fetched first.
