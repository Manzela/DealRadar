# DealRadar

Geo-located, multilingual deals aggregator for Europe. Next.js 14 (App Router, TypeScript), Tailwind + shadcn-style components, next-intl, Supabase, Upstash Redis.

## Quick start

```bash
corepack enable
pnpm install
cp .env.example .env.local   # fill in what you have — everything is optional for dev
pnpm dev
```

**Zero-config dev mode:** with an empty `.env.local` the app runs entirely on deterministic mock data (all four providers fall back to seeded fixtures, Supabase reads are bypassed in-memory, Redis becomes a no-op). The full UI — geolocation, search, filters, i18n — is browsable without any keys.

## Environment variables

See `.env.example` for the full annotated list. Summary:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Deals persistence (server-only key) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | 30-min response cache |
| `KELKOO_API_TOKEN` | Primary live provider (per-country JWT from Kelkoo Publisher Center) |
| `AWIN_API_KEY`, `AWIN_PUBLISHER_ID` | Secondary provider (see "AWIN gap" below) |
| `TRADEDOUBLER_TOKEN` | Tertiary provider |
| `IDEALO_API_KEY` | Reserved — no self-service API exists; stays mock |
| `CRON_SECRET` | Bearer auth for `POST /api/refresh` |

## Database setup

Run `supabase/schema.sql` in the Supabase SQL editor. It creates the `deals` table, trigram + composite indexes, the `distinct_brands()` RPC, and enables RLS. An optional `pg_cron` purge for stale rows is included commented out.

## Data refresh

`POST /api/refresh` with `Authorization: Bearer $CRON_SECRET` fans out across all supported countries × categories, pulls from providers in priority order, and upserts into Supabase. `docker-compose.yml` includes a curl sidecar that hits it every 15 minutes. On Vercel, use a Vercel Cron job instead.

## Adding a new price provider

1. Create `src/lib/providers/<name>.ts` implementing the `PriceProvider` interface from `src/lib/providers/types.ts` (stateless; throw `ProviderError` on failure; prefix `productId` with `<name>:`).
2. Add one line to the `PROVIDERS` array in `src/lib/providers/registry.ts` with a unique `priority` (lower = tried first).

That's it — fall-through, dedup, caching, and persistence are handled by the registry and route layer.

## Adding a new locale

1. Add the locale code to `LOCALES` in `src/i18n/routing.ts`.
2. Create `src/messages/<locale>.json` (copy `en.json` and translate).
3. Add the label to `LanguageSwitcher.tsx`.

## Known gaps / TODO before production

- **Translations:** only `en` and `de` are real. `fr`, `es`, `it`, `pl`, `nl`, `pt`, `sv`, `ro` are English stubs that need translation.
- **AWIN gap:** AWIN distributes per-advertiser product feeds (CSV), not a search API. The live path in `src/lib/providers/awin.ts` intentionally throws — a feed-ingestion worker is needed (download feeds on schedule, map rows via the exported `normalizeAwinRow()`, upsert to Supabase). Mock fallback works meanwhile.
- **Kelkoo response shape:** the offer-mapping interfaces were written from public docs; verify against a live response in requestbuilder.kelkoogroup.com once you have a token.
- **Image domains:** `next.config.mjs` `remotePatterns` are permissive for the affiliate CDNs; tighten for production.
- **Idealo:** no public publisher API — partnership only (idealo.de/partner). Provider remains mock.

## Docker

```bash
docker compose up --build
```

Multi-stage build (node:20-alpine, non-root), web on :3000, plus the refresh cron sidecar.
