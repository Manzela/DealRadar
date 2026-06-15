/**
 * AWIN product feed provider — SECONDARY source.
 *
 * Registration: https://www.awin.com → "Publishers" sign-up (small refundable
 * deposit). Then: Toolbox → Create-a-Feed / Product Feed API to get your feed
 * list URL and API key, and join advertiser programmes per country.
 * Docs: https://wiki.awin.com/index.php/Product_Feeds
 *
 * AWIN serves large CSV/JSON feeds rather than a search API, so this provider
 * pulls a feed page and filters by discount. For production, schedule the cron
 * refresh frequently enough (≤30 min) and consider downloading delta feeds.
 */
import {
  type CountryCode, type DealQuery, type NormalizedDeal, type PriceProvider,
  type ProviderHealth, ProviderError, computeDiscountPercent,
} from './types';
import { generateMockDeals } from './mock-data';
import { mapExternalCategory } from './category-map';

export class AwinProvider implements PriceProvider {
  readonly id = 'awin';
  readonly displayName = 'AWIN';
  readonly supportedCountries: CountryCode[] = ['DE','AT','FR','ES','IT','PL','NL','SE','GB','BE','DK','FI','NO','CH'];
  readonly priority = 20;

  private apiKey = process.env.AWIN_API_KEY ?? '';
  private publisherId = process.env.AWIN_PUBLISHER_ID ?? '';
  private mock = false;

  async init(): Promise<ProviderHealth> {
    if (!this.apiKey || !this.publisherId) {
      this.mock = true;
      const message =
        'AWIN_API_KEY / AWIN_PUBLISHER_ID not set — using mock data. Apply at https://www.awin.com (publisher sign-up), then create an API key under Toolbox → API Credentials.';
      console.warn(`[awin] ${message}`);
      return { ok: true, isMock: true, message };
    }
    return { ok: true, isMock: false };
  }

  async fetchDeals(query: DealQuery): Promise<NormalizedDeal[]> {
    if (this.mock) return generateMockDeals(this.id, query);

    /*
     * MISSING / INTENTIONALLY FLAGGED:
     * AWIN's product data is delivered as per-advertiser feed downloads
     * (datafeed_api endpoints with a feed list per joined programme), not a
     * cross-advertiser search endpoint. A faithful implementation needs:
     *   1. GET the feed list (CSV) using the API key,
     *   2. download per-advertiser feeds for the target country,
     *   3. stream-parse and filter rows where search_price < rrp_price.
     * That is an offline ingestion job (several hundred MB), out of scope for a
     * synchronous fetch. Until the ingestion worker exists, live AWIN mode
     * fails loudly instead of pretending.
     */
    throw new ProviderError(
      this.id, false,
      'Live AWIN mode requires the feed-ingestion worker (see comment in awin.ts). Unset AWIN_API_KEY to use mock data, or implement the worker.',
    );
  }
}

// Re-exported so the (future) ingestion worker normalizes rows identically.
export function normalizeAwinRow(row: Record<string, string>, country: CountryCode): NormalizedDeal | null {
  const sale = parseFloat(row['search_price']);
  const original = parseFloat(row['rrp_price'] || row['search_price']);
  if (!Number.isFinite(sale)) return null;
  const discountPercent = computeDiscountPercent(original, sale);
  if (discountPercent === 0) return null;
  return {
    productId: `awin:${row['aw_product_id']}`,
    productName: row['product_name'],
    shopName: row['merchant_name'],
    shopUrl: row['aw_deep_link'],
    shopLogoUrl: null,
    originalPrice: original,
    salePrice: sale,
    discountPercent,
    currency: row['currency'] || 'EUR',
    category: mapExternalCategory(row['merchant_category'] ?? ''),
    brand: row['brand_name'] || null,
    imageUrl: row['merchant_image_url'] || null,
    country,
    city: null,
    isSponsored: true,
    source: 'awin',
    lastUpdated: new Date().toISOString(),
  };
}
