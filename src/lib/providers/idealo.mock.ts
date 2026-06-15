/**
 * Idealo provider — MOCK ONLY until partner approval.
 *
 * Reality check (researched 2026-06): Idealo's public "Partner Web Service"
 * (PWS 2.0) is a MERCHANT inventory API, not a price-comparison feed for
 * publishers. There is no self-service API for third-party comparison sites.
 * Partnership inquiries: https://www.idealo.de/partner (business team) or
 * tam@idealo.de. If a data partnership is ever granted, implement the live
 * client here and flip `priority` below Kelkoo for DACH countries.
 */
import {
  type CountryCode, type DealQuery, type NormalizedDeal,
  type PriceProvider, type ProviderHealth,
} from './types';
import { generateMockDeals } from './mock-data';

export class IdealoMockProvider implements PriceProvider {
  readonly id = 'idealo-mock';
  readonly displayName = 'Idealo (mock)';
  readonly supportedCountries: CountryCode[] = ['DE', 'AT', 'FR', 'IT', 'ES', 'GB', 'PL'];
  readonly priority = 40; // last resort; mock data only

  async init(): Promise<ProviderHealth> {
    const message =
      'IDEALO_API_KEY not set — using mock data. Apply at https://www.idealo.de/partner ' +
      '(note: no self-service publisher API exists; this requires a negotiated data partnership).';
    console.warn(`[idealo-mock] ${message}`);
    return { ok: true, isMock: true, message };
  }

  async fetchDeals(query: DealQuery): Promise<NormalizedDeal[]> {
    return generateMockDeals(this.id, query);
  }
}
