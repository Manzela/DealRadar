/**
 * POST /api/refresh — scheduled provider sync. Protected by CRON_SECRET.
 *
 * This is what keeps the 30-minute freshness guarantee: a cron (Vercel cron,
 * GitHub Action, or the docker-compose `cron` service) hits this route every
 * 15 minutes; it fans out across countries × categories, pulls from providers
 * via the registry, and upserts into Supabase. User-facing routes never call
 * upstream APIs directly.
 *
 * Body (optional): { "countries": ["DE","FR"], "categories": ["electronics"] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchDealsAcrossProviders } from '@/lib/providers/registry';
import { upsertDeals } from '@/lib/db/deals.repo';
import { SUPPORTED_COUNTRIES, CATEGORY_SLUGS, type CategorySlug, type CountryCode } from '@/lib/providers/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { countries?: CountryCode[]; categories?: CategorySlug[] } = {};
  try { body = await req.json(); } catch { /* empty body = full sync */ }

  const countries = body.countries ?? [...SUPPORTED_COUNTRIES];
  const categories = body.categories ?? [...CATEGORY_SLUGS];
  const summary: Record<string, number> = {};

  for (const country of countries) {
    let count = 0;
    for (const category of categories) {
      try {
        const deals = await fetchDealsAcrossProviders({ country, category, limit: 100 });
        count += await upsertDeals(deals);
      } catch (e) {
        console.error(`[api/refresh] ${country}/${category} failed:`, e);
      }
    }
    summary[country] = count;
  }

  return NextResponse.json({ ok: true, upserted: summary, at: new Date().toISOString() });
}
