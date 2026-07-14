import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/utils/site-url';

/**
 * Single source of truth for robots.txt. There must be NO public/robots.txt —
 * a static file silently shadows this route (that's how a hardcoded
 * dealradar.eu sitemap URL shipped for months).
 *
 * Policy (GEO/AEO thesis — organic + AI-answer visibility is the traffic
 * model, so AI crawlers are explicitly INVITED, never blocked):
 *
 *  - Search/answer-index bots (drive citations + referral traffic) and
 *    user-triggered fetchers (fetch a page when a human asks an assistant)
 *    get explicit groups. A robots.txt group is exclusive — a UA obeys only
 *    its most specific match — so every named group must repeat the disallow
 *    list; it does NOT inherit from `*`.
 *  - Training crawlers are also allowed: deals/brand knowledge inside future
 *    models is upside for a price-comparison brand, not leakage.
 *  - Crawl-trap hygiene (commerce faceted-nav standard): internal search
 *    results and infinite/duplicate parameter spaces are disallowed for
 *    everyone — they waste crawl budget without adding indexable value.
 *    Plain ?page= pagination stays crawlable.
 */

const DISALLOW = [
  '/api/',        // machine endpoints, never content
  '/*/search',    // internal search results (noindex'd as belt; blocked as suspenders)
  '/*?*seed=',    // random-shuffle seed → infinite unique-URL space
  '/*?*sort=',    // sort permutations → duplicate content
  '/*?*minPrice=',
  '/*?*maxPrice=',
  '/*?*minDiscount=',
  '/*?*brand=',   // facet params: duplicates of the canonical category view
];

// Answer/search-engine indexers + assistants' live-retrieval bots.
const AI_SEARCH_BOTS = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'DuckAssistBot', 'Amazonbot', 'Applebot'];
// User-triggered fetchers (act on a human's behalf inside an assistant).
const AI_USER_FETCHERS = ['ChatGPT-User', 'Claude-User', 'Perplexity-User', 'Meta-ExternalFetcher'];
// Model-training crawlers (deliberately allowed — GEO thesis).
const AI_TRAINING_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Meta-ExternalAgent', 'Bytespider'];

export default function robots(): MetadataRoute.Robots {
  const group = (userAgent: string) => ({ userAgent, allow: '/', disallow: DISALLOW });
  return {
    rules: [
      group('*'),
      ...AI_SEARCH_BOTS.map(group),
      ...AI_USER_FETCHERS.map(group),
      ...AI_TRAINING_BOTS.map(group),
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
