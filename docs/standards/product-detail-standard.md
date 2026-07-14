# Product detail page — the standard (all shops, all future providers)

Every deal's detail page must offer the same experience regardless of which
shop or feed it came from. Established 2026-07-13; the mechanisms below keep it
true automatically — new providers must plug into them, not around them.

## The standard

1. **Full-resolution images, never proxy thumbnails.** Affiliate-network image
   proxies (e.g. Awin's productserve, fixed 200×200) are display-banned on the
   detail page. `unproxyImage()` in `src/lib/utils/product-details.ts` swaps a
   proxy URL for the original merchant image it embeds; `productGallery()`
   applies it and dedupes. A new provider whose images come proxied needs its
   extraction added there.

2. **Multi-image gallery for every product.** `DealGallery`
   (`src/components/deals/DealGallery.tsx`) renders main image + thumbnails.
   When a feed ships fewer than 2 real images, `scripts/enrich-galleries.cjs`
   tops the gallery up from the merchant's live product page (Shopify
   `/products/<handle>.js`) — it runs in the daily verify workflow
   (`.github/workflows/verify-awin.yml`), so sparse products self-heal within
   a day. Non-Shopify merchants need an equivalent lookup added to that script.

3. **Real description, always rendered.** `deals.description` (feed text,
   captured at ingest) displays under the product. No synthetic copy.

4. **Live data — never a cached render.** Detail pages declare
   `export const dynamic = 'force-dynamic'` like the category/search pages.
   Without it Next.js caches the Supabase reads and the page serves stale
   prices/galleries until the next deploy, silently defeating the daily
   verifier.

5. **Honest price history.** The cardiogram's window spans the recorded
   minimum (`price_history` table + `deals.historical_low_price`); today's dot
   sits at its true position. Nothing fabricated: no fake walks, no invented
   specs, no fake offers (see the 2026-06-29 honesty pass).

## Checklist for adding a provider/shop

- [ ] Images: proxied? extend `unproxyImage()`. Fewer than 2 per product?
      extend `enrich-galleries.cjs` for that merchant's platform.
- [ ] Description captured at ingest into `deals.description`.
- [ ] Detail route stays `force-dynamic`.
- [ ] Verify with the shop's worst product (fewest images) — its page must
      look the same as the best one.
