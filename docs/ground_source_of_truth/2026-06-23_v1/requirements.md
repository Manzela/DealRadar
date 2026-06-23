# Requirements Document: DealRadar Headless Affiliate Aggregator & GEO

This document compiles the functional and non-functional requirements for transitioning DealRadar from mock data to real-time programmatic affiliate feeds, implementing a Generative Engine Optimization (GEO) strategy, and refining local scoping.

---

## 1. Functional Requirements (EARS Notation)

### Ingestion & Data Pipeline
* **FR-ING-1 (Event-driven):** When the `/api/refresh` endpoint receives a valid POST request, the system shall fetch live deals from the Strackr API.
* **FR-ING-2 (State-driven):** While importing deals from the API, the system shall normalize product details (name, prices, image URL, affiliate tracking link, network name, and merchant name) to fit the internal schema.
* **FR-ING-3 (Ubiquitous):** The system shall compute a dynamic discount percentage (`discount_percentage`) for each ingested deal based on `original_price` and `sale_price`.
* **FR-ING-4 (Unwanted Behavior):** If the system identifies a duplicate product (sharing the same EAN barcode or matching cleaned name and merchant keys) across multiple networks, then the system shall persist only the deal that offers the deepest discount percentage.
* **FR-ING-5 (Event-driven):** When saving deals to the database, the system shall run a bulk upsert that inserts new deals and updates existing records (e.g. if the price drops further) by matching on `(affiliate_network, native_product_id)`.
* **FR-ING-6 (Event-driven):** When a deal's price drops below the user's subscribed alert price during ingestion, the system shall dispatch a price-drop email alert to the subscriber and mark the alert as notified.

### Tracking & Monetization
* **FR-TRK-1 (Ubiquitous):** The system shall construct affiliate links with programmatically appended subIDs structured as `?subid1=user_country&subid2=product_category&subid3=deal_id` when rendering outward links.
* **FR-TRK-2 (Event-driven):** When the serverless postback listener (`/api/postbacks` or `/api/alerts/postbacks`) receives a transaction ping from the affiliate network, the system shall process the payload and update the internal database to attribute commission to the respective `deal_id` (via `subid3`).

### Generative Engine Optimization (GEO) & SEO
* **FR-GEO-1 (Ubiquitous):** The system shall output semantic `Product` and `AggregateOffer` schema markups (JSON-LD) on every deal page.
* **FR-GEO-2 (Ubiquitous):** The system shall inject "AI-Scrapable Proof Fields" (including historic low price status, relative local price comparison, and verification timestamp) on every deal page.
* **FR-GEO-3 (Ubiquitous):** The system shall expose a `robots.txt` configuration that allows access to all AI search agents (e.g. `OAI-SearchBot`, `PerplexityBot`, `Google-Extended`) while disallowing execution routes (`/api/click`, `/api/refresh`).
* **FR-GEO-4 (Event-driven):** When the refresh cron job updates the inventory, the system shall update a dynamic `sitemap.xml` file containing all active deal detail links.

### Geolocation & Middleware Scoping
* **FR-LOC-1 (Event-driven):** When a request is received, the middleware shall inspect Netlify geo-forwarding headers (`x-nf-client-connection-ip`, `X-NF-Country`) and forward the country code to the i18n/localization layer.
* **FR-LOC-2 (Unwanted Behavior):** If the resolved country is not supported, then the system shall fall back to the default country code (`DE`).

---

## 2. Non-Functional Requirements

### Performance & Caching
* **NFR-PERF-1:** Page loads for top deals lists must leverage the existing Upstash Redis caching layer, maintaining a maximum response cached TTL of 30 minutes.
* **NFR-PERF-2:** Serverless ingestion routes (`/api/refresh`) must complete execution within serverless execution limits (e.g., Netlify's 10-second request limit or Vercel's configured `maxDuration = 300` limit).

### Security & Privacy
* **NFR-SEC-1:** Access to critical administration paths and endpoints (`/api/refresh`) must be restricted using Bearer authentication validated against a cryptographically secure `CRON_SECRET` env var.
* **NFR-SEC-2:** Database Row-Level Security (RLS) must remain enabled on all tables, and the application must connect server-side only using the service-role key to prevent public data exposure.
* **NFR-SEC-3:** Geographic coordinates used for geolocation reverse-lookup must be handled transiently on the server and must never be persisted.

### Tech Stack Constraints
* **NFR-TECH-1:** The backend codebase must run on Node.js 20 with TypeScript.
* **NFR-TECH-2:** The persistence layer must be Supabase PostgreSQL.
* **NFR-TECH-3:** Frontend routing must be compatible with Next.js 14 App Router and next-intl for localization.

---

## 3. Edge Cases & Assumptions

### Edge Cases
* **Strackr API Failures/Rate Limits:** If the Strackr API is unreachable or rate-limited (status code 429 or 5xx), the ingestion pipeline must throw a `ProviderError`, write a log entry, and safely abort without corrupting existing database states.
* **No Price Change during Upsert:** If an ingested deal already exists and the sale price has not changed, the system must update `updated_at` without triggering a new price-drop notification.
* **Missing EAN and Duplicate Names:** If EAN code is null for duplicate deals, the system must fall back to matching by a slugified combination of product name and merchant name.
* **Unsupported Country Codes:** If a user connects from outside the supported list, the system must serve default (`DE`) data.

### Assumptions
* The Strackr API key (`STRACKR_API_KEY`) is active and has permissions to pull product data feeds for the DACH and wider European regions.
* The outgoing email sender (e.g. Resend, Nodemailer) is configured and capable of successfully dispatching price drop alerts.
* The frontend deployment is hosted on a platform (such as Netlify or Vercel) that supports geo-headers (`x-nf-country`, `x-vercel-ip-country`).

---

## 4. Success Metrics

1. **Successful Compilation:** The TypeScript build command (`pnpm build` or `npm run build`) runs without compilation errors.
2. **Deduplicated Ingestion:** Running `/api/refresh` processes raw products, removes duplicates (keeping the best discount), and inserts/updates records successfully.
3. **Structured Metadata Coverage:** Every deal page (`/deal/[slug]`) renders valid Schema.org JSON-LD validator output containing `Product` and `AggregateOffer` elements.
4. **Robots Visibility:** Navigating to `/robots.txt` yields the specified configuration rules for AI bots.
5. **No Vibe-Coding:** Every code change conforms to the final approved `design.md` specifications.
