/** GET /api/brands?country=DE&category=electronics — burger-menu brand filters. */
import { NextRequest, NextResponse } from 'next/server';
import { distinctBrands } from '@/lib/db/deals.repo';
import { cacheGet, cacheKey, cacheSet } from '@/lib/cache/redis';
import { isSupportedCountry } from '@/lib/geo/countries';
import { CATEGORY_SLUGS, type CategorySlug } from '@/lib/providers/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const country = p.get('country') ?? '';
  const category = p.get('category') ?? undefined;
  if (!isSupportedCountry(country)) {
    return NextResponse.json({ error: 'unsupported_country' }, { status: 400 });
  }
  if (category && !CATEGORY_SLUGS.includes(category as CategorySlug)) {
    return NextResponse.json({ error: 'unknown_category' }, { status: 400 });
  }

  const key = cacheKey('brands', { country, category });
  const cached = await cacheGet<string[]>(key);
  if (cached) return NextResponse.json({ brands: cached });

  try {
    const brands = await distinctBrands(country, category as CategorySlug | undefined);
    await cacheSet(key, brands);
    return NextResponse.json({ brands });
  } catch (e) {
    console.error('[api/brands]', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
