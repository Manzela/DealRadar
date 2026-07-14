import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/utils/site-url';

/**
 * Single source of truth for robots.txt. There must be NO public/robots.txt —
 * a static file silently shadows this route (that's how a hardcoded
 * dealradar.eu sitemap URL shipped for months). Host comes from siteUrl() so
 * the canonical domain can never drift from the sitemap/canonicals.
 *
 * The named AI/answer-engine crawlers are explicitly invited (GEO/AEO thesis):
 * an explicit group means a future blanket tightening of `*` won't silently
 * drop them.
 */
export default function robots(): MetadataRoute.Robots {
  const aiCrawlers = ['OAI-SearchBot', 'PerplexityBot', 'Google-Extended'];
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/'] },
      ...aiCrawlers.map((ua) => ({ userAgent: ua, allow: '/', disallow: ['/api/'] })),
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
