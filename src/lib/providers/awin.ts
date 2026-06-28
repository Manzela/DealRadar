/**
 * AWIN provider — feed-ingested, NOT a per-query search API.
 *
 * AWIN distributes one large combined PRODUCT FEED (gzipped CSV, ~300 MB), not a
 * search endpoint, so it cannot be pulled per request like Kelkoo/DummyJSON.
 * Instead a scheduled job (`scripts/ingest-awin.cjs`) downloads the feed, keeps
 * the genuine in-stock discounts, and upserts them into Supabase. The app then
 * reads those rows from the `deals` table like any other deal.
 *
 * Consequently this provider does NOT fetch on the per-query path:
 *  - no AWIN_FEED_URL → mock data (so dev/preview still shows AWIN-labelled deals),
 *  - AWIN_FEED_URL set → returns [] here (the real deals arrive via ingestion).
 *
 * Setup: register at https://www.awin.com (publisher, small refundable deposit),
 * join advertiser programmes, then Toolbox → Create-a-Feed to get the datafeed
 * download URL. Put it in AWIN_FEED_URL (the URL embeds your API key — keep it
 * secret) and run the ingestion script on a schedule. See scripts/ingest-awin.cjs.
 */
import {
  type CountryCode, type DealQuery, type NormalizedDeal, type PriceProvider,
  type ProviderHealth,
} from './types';
import { generateMockDeals } from './mock-data';

export class AwinProvider implements PriceProvider {
  readonly id = 'awin';
  readonly displayName = 'AWIN';
  readonly supportedCountries: CountryCode[] = ['DE','AT','FR','ES','IT','PL','NL','SE','GB','BE','DK','FI','NO','CH'];
  readonly priority = 20;

  private feedConfigured = Boolean(process.env.AWIN_FEED_URL);

  async init(): Promise<ProviderHealth> {
    if (!this.feedConfigured) {
      const message =
        'AWIN_FEED_URL not set — using mock data. Get a datafeed download URL from AWIN (Toolbox → Create-a-Feed), set AWIN_FEED_URL, and run scripts/ingest-awin.cjs on a schedule.';
      console.warn(`[awin] ${message}`);
      return { ok: true, isMock: true, message };
    }
    // Feed configured: deals are ingested into Supabase out of band, so the
    // per-query path has nothing live to add (fetchDeals returns []).
    return { ok: true, isMock: false, message: 'AWIN is feed-ingested via scripts/ingest-awin.cjs → Supabase.' };
  }

  async fetchDeals(query: DealQuery): Promise<NormalizedDeal[]> {
    if (!this.feedConfigured) return generateMockDeals(this.id, query);
    return []; // live AWIN deals come from the ingestion job, not this code path
  }
}
