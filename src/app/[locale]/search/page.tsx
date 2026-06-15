import { cookies } from 'next/headers';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DealGrid } from '@/components/deals/DealGrid';
import { FilterPanel } from '@/components/search/FilterPanel';
import { queryDeals, distinctBrands, type DealFilters } from '@/lib/db/deals.repo';
import { parseLocationCookie, LOCATION_COOKIE } from '@/lib/geo/resolve';
import { DEFAULT_COUNTRY } from '@/lib/geo/countries';
import { CATEGORY_SLUGS, type CategorySlug } from '@/lib/providers/types';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations('search');

  const cookieStore = await cookies();
  const loc = parseLocationCookie(cookieStore.get(LOCATION_COOKIE)?.value);
  const country = loc?.country ?? DEFAULT_COUNTRY;

  const rawCategory = one(sp.category);
  const category = CATEGORY_SLUGS.includes(rawCategory as CategorySlug)
    ? (rawCategory as CategorySlug)
    : undefined;

  const filters: DealFilters = {
    country,
    city: loc?.city ?? undefined,
    q: one(sp.q) || undefined,
    category,
    brand: one(sp.brand) || undefined,
    minDiscountPercent: toNum(one(sp.minDiscount)),
    minPrice: toNum(one(sp.minPrice)),
    maxPrice: toNum(one(sp.maxPrice)),
    sort: (one(sp.sort) as DealFilters['sort']) ?? 'discount',
    limit: 48,
  };

  const [deals, brands] = await Promise.all([
    queryDeals(filters),
    distinctBrands(country, category),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <FilterPanel brands={brands} category={category} />
      <section aria-live="polite">
        <h1 className="mb-6 text-xl font-semibold tracking-tight">
          {filters.q ? t('resultsFor', { q: filters.q }) : t('allResults')}
          <span className="ml-2 text-sm font-normal text-zinc-400">({deals.length})</span>
        </h1>
        {deals.length > 0 ? (
          <DealGrid deals={deals} />
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-200 p-10 text-center text-zinc-500">
            {t('noResults')}
          </p>
        )}
      </section>
    </div>
  );
}

function toNum(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
