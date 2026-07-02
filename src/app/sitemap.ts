/**
 * Minimal sitemap: per-locale home + category pages (the crawlable surface —
 * deals themselves render in a modal, not on their own URLs yet). Per-deal
 * pages with JSON-LD are a roadmap item; extend this when they exist.
 */
import type { MetadataRoute } from 'next';
import { LOCALES } from '@/i18n/routing';
import { CATEGORY_SLUGS } from '@/lib/providers/types';

const BASE = (process.env.URL || 'https://dealradar.me').replace(/\/+$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of LOCALES) {
    entries.push({ url: `${BASE}/${locale}`, lastModified: now, changeFrequency: 'daily', priority: 1 });
    for (const slug of CATEGORY_SLUGS) {
      entries.push({
        url: `${BASE}/${locale}/category/${slug}`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.7,
      });
    }
  }
  return entries;
}
