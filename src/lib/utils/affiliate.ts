/**
 * Affiliate link decoration. Kelkoo/AWIN/Tradedoubler URLs already arrive
 * monetized (goUrl / aw_deep_link / productUrl). We only append our own
 * sub-id for attribution where the network supports it.
 */
const SUBID_PARAM: Record<string, string> = {
  kelkoo: 'custom1',
  awin: 'clickref',
  tradedoubler: 'epi',
};

export function decorateAffiliateUrl(shopUrl: string, source: string): string {
  const param = SUBID_PARAM[source];
  if (!param || !shopUrl) return shopUrl;
  try {
    const url = new URL(shopUrl);
    if (!url.searchParams.has(param)) url.searchParams.set(param, 'dealradar');
    return url.toString();
  } catch {
    return shopUrl;
  }
}
