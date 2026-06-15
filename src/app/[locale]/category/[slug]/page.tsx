import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
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

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!CATEGORY_SLUGS.includes(slug as CategorySlug)) notFound();
  const category = slug as CategorySlug;
  const sp = await searchParams;

  const t = await getTranslations('categories');
  const tSearch = await getTranslations('search');
  const cookieStore = await cookies();
  const loc = parseLocationCookie(cookieStore.get(LOCATION_COOKIE)?.value);
  const country = loc?.country ?? DEFAULT_COUNTRY;

  // Category is fixed by the route; brand/price/discount/sort come from the URL
  // so the FilterPanel actually drives the results.
  const filters: DealFilters = {
    country,
    city: loc?.city ?? undefined,
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
          {t(category)}
          <span className="ml-2 text-sm font-normal text-zinc-400">({deals.length})</span>
        </h1>
        {deals.length > 0 ? (
          <DealGrid deals={deals} />
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-200 p-10 text-center text-zinc-500">
            {tSearch('noResults')}
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
