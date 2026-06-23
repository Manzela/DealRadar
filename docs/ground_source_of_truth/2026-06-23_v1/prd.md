# Product Requirements Document (PRD)
## Project: DealRadar Headless Affiliate Aggregator & Generative Engine Optimization (GEO)

* **Status:** Draft / Pending Review
* **Target Release:** Q3 2026
* **Owner:** Principal Architect & PM Team
* **Last Updated:** 2026-06-23

---

## 1. Executive Summary & Vision

### Vision Statement
DealRadar is the premier European geo-located shopping companion, connecting consumers with verified, localized price reductions. By transforming our platform from a visual, client-only catalog to an automated, headless affiliate aggregator and AI-crawlable semantic database, DealRadar aims to capture both traditional web users and the emerging market of **autonomous AI consumers** (e.g., SearchGPT, Gemini, Perplexity).

### Core Goals
1. **Automate Monetization:** Transition from static, mock, or hard-coded lists to a programmatic data feed that dedupes deals and dynamically structures tracking links to monetize every click.
2. **Generative Engine Optimization (GEO):** Structure our page output so that AI bots crawl, verify, and cite DealRadar as their primary authority when users search for European deals.
3. **True Local Scoping:** Maintain instant, cookie-driven server-side rendering (SSR) of localized content based on edge IP detection.

---

## 2. Problem Statement & Opportunities

### Current Pain Points
* **Mock Baseline:** The current codebase depends on mock data structures in development and falls back to a limited number of hardcoded feeds. It lacks automated monetization links.
* **Lack of Shareable Pages:** Individual deals open inside dynamic React modals rather than dedicated static pages. This makes it impossible for search engines (traditional or LLM-based) to index specific deal items or link to them directly.
* **Weak Attribution:** Outward links are not programmatically tracked. There is no serverless postback capability to attribute sales commissions back to specific product tiles.
* **Cold Starts on Location:** Location detection runs on client-side JS fallbacks, causing visual layout shifts (CLS) on initial load and rendering generic content to automated indexers.

### The Opportunity
By exposing structured Schema.org markup alongside automated database calculations (historic lows, price comparisons), DealRadar can become a primary data source for AI search crawlers. AI agents reward highly formatted data that provides "proof" of assertions with canonical footnotes.

---

## 3. Product Scope & Core Pillars

The project is structured around 5 key technical pillars:

```mermaid
graph TD
    A[DealRadar Core Platform] --> B[1. Headless Ingestion]
    A --> C[2. Database Persistence]
    A --> D[3. GEO Schema & Routing]
    A --> E[4. Edge Location Scoping]
    A --> F[5. Webhook Postbacks]
    
    B --> B1[Strackr /v3/offers API]
    C --> C1[Supabase Postgres schema migration]
    D --> D1[/[locale]/deal/[slug] page & JSON-LD]
    E --> E1[Netlify/Vercel Edge headers & middleware cookie]
    F --> F1[api/postbacks commission attribution]
```

---

## 4. User & Crawler Personas

### Persona A: The Deal Seeker (End User)
* **Goal:** Wants to find the lowest price for a specific product in their country/city.
* **Need:** Accurate prices, real discount percentages, historical context, and direct merchant links.

### Persona B: The Generative Search Agent (AI Bot)
* **Goal:** Crawls the web looking for authoritative answers to queries like *"Where can I buy the Samsung S24 Ultra cheapest in Germany right now?"*
* **Need:** Dynamic JSON-LD markup, historical price verification, clean canonical links, and high uptime.

### Persona C: The Developer/PM (Operations)
* **Goal:** Needs to run and test the codebase locally without active API keys or database connections.
* **Need:** Seamless mock-mode fallback when credentials are not configured in `.env`.

---

## 5. Functional Requirements (EARS Notation)

### Ingestion & Deduplication
* **FR-ING-1:** **When** the Scheduled Refresher triggers a POST request to `/api/refresh`, the system **shall** fetch the latest regional deals from the unified Strackr Deals API.
* **FR-ING-2:** **While** processing raw deals from the API, the system **shall** calculate a dynamic discount percentage (`discount_percentage`) based on `original_price` and `sale_price`.
* **FR-ING-3:** **If** duplicate product offers (same EAN barcode or matching name + merchant) are detected from different networks, **then** the system **shall** retain only the deal with the deepest discount.
* **FR-ING-4:** **When** a deal's price drops further during upsert, the system **shall** update the record and compare the new sale price against registered `price_alerts` subscriptions.

### Routing, UX & SEO
* **FR-RTE-1:** **When** a user clicks a deal tile on the home grid, the system **shall** route the browser to the dedicated SSR deal page `/[locale]/deal/[slug]` instead of launching a client-side modal.
* **FR-RTE-2:** **When** a request hits `/[locale]/deal/[slug]`, the page **shall** dynamically render:
  * Title structured as: `[deal.productName] - Best Deal in Germany | DealRadar`
  * Canonical alternate URLs mapped to the current locale path.
  * Contextual proof text (e.g. *"This product has reached its lowest price in 90 days"*).
* **FR-RTE-3:** **When** an AI crawler requests `/robots.txt`, the server **shall** output rules prioritizing search bots (`OAI-SearchBot`, `PerplexityBot`, `Google-Extended`) and disallowing programmatic endpoints (`/api/click`, `/api/refresh`).
* **FR-RTE-4:** **When** the refresh cron completes, the system **shall** generate/update a dynamic `sitemap.xml` index of active deal detail pages.

### Geolocation
* **FR-GEO-1:** **When** a request lacks the `dr_location` cookie, the edge middleware **shall** resolve the visitor's country code using Netlify/Vercel geolocation IP headers.
* **FR-GEO-2:** **If** the edge-resolved country is not supported by DealRadar, **then** the system **shall** write a default country code (`DE`) to the `dr_location` cookie.

### Transaction Attributes (Postbacks)
* **FR-TRK-1:** **When** outgoing affiliate links are rendered, the system **shall** append structured subids tracking client country, category, and target `deal_id`.
* **FR-TRK-2:** **When** the `/api/postbacks` webhook receives a payout event, the system **shall** query the database using the payload's `subid3` parameter and increment the earnings log for that deal.

---

## 6. Non-Functional Requirements (NFRs)

### Performance & Scaling
* **NFR-PERF-1:** Main page routing and list queries must maintain sub-100ms response times by caching outputs on Upstash Redis with a maximum TTL of 30 minutes.
* **NFR-PERF-2:** Database queries on product name and brand must utilize Postgres GIN indices to prevent full-table scans.

### Security
* **NFR-SEC-1:** Serverless API endpoints managing inventory updates (`/api/refresh`) must reject requests lacking a `Bearer $CRON_SECRET` authorization header.
* **NFR-SEC-2:** Database security policies (RLS) must restrict direct anon queries, forcing database interactions to run server-side using the Supabase Service Role configuration.

---

## 7. Key Architecture & Data Models

### Database Schema Updates
We will run migrations on the Supabase PostgreSQL database to support:
1. `ean_code` - Barcode tracking for deep programmatic deduplication.
2. `slug` - Safe, unique URL slugs for detail pages.
3. `historical_low_price` - Tracking historical lows for AI validation.
4. `affiliate_network`, `native_product_id`, `merchant_name`, `tracking_url` - Mapping standard affiliate parameters.

### Schema.org Integration (Product & AggregateOffer)
The page markup on `/deal/[slug]` will inject a structured JSON-LD block:
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Samsung Galaxy S24 Ultra",
  "image": "https://images.affiliatecdn.com/samsung-s24.jpg",
  "description": "Save 27% on Samsung Galaxy S24 Ultra...",
  "offers": {
    "@type": "AggregateOffer",
    "priceCurrency": "EUR",
    "lowPrice": "1049.00",
    "highPrice": "1449.00",
    "offerCount": "1",
    "offers": [
      {
        "@type": "Offer",
        "price": "1049.00",
        "priceCurrency": "EUR",
        "seller": {
          "@type": "Organization",
          "name": "Samsung DE"
        }
      }
    ]
  }
}
```

---

## 8. Risks, Assumptions, & Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Strackr API Rate Limits / Failure** | High | If Strackr fails, the pipeline logs a `ProviderError` and aborts ingestion, leaving existing DB rows intact. Old deals purge on a rolling 24-hour cycle. |
| **Missing Barcodes (EANs)** | Medium | When EAN is null, the deduplication engine falls back to a composite key of slugified name and merchant name. |
| **Search Engine Crawler Spin-ups** | Low | Middleware excludes crawler traffic from hitting serverless API endpoints via strict `robots.txt` disallows, avoiding unnecessary serverless compute costs. |

---

## 9. Success Metrics & Key Performance Indicators (KPIs)

1. **AI Indexation and Citations:** Growth in referrals and citation footnotes from Perplexity/SearchGPT.
2. **Core Web Vitals:** Maintain an LCP of < 2.5s and CLS of 0.0 by using edge-resolved country cookies instead of client-side location lookups.
3. **Monetization Yield:** Conversion rate tracking of mapped payouts via postbacks.
4. **Build Performance:** Static routing compilation of slug layouts completing under Next.js build-timeout limits.
