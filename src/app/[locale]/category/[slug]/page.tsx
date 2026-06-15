import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DealGrid } from '@/components/deals/DealGrid';
import { FilterPanel } from '@/components/search/FilterPanel';
import { queryDeals, distinctBrands } from '@/lib/db/deals.repo';
import { parseLocationCookie, LOCATION_COOKIE } from '@/lib/geo/resolve';
import { DEFAULT_COUNTRY } from '@/lib/geo/countries';
import { CATEGORY_SLUGS, type CategorySlug } from '@/lib/providers/types';

export const dynamic = 'force-dynamic';

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!CATEGORY_SLUGS.includes(slug as CategorySlug)) notFound();
  const category = slug as CategorySlug;

  const t = await getTranslations('categories');
  const cookieStore = await cookies();
  const loc = parseLocationCookie(cookieStore.get(LOCATION_COOKIE)?.value);
  const country = loc?.country ?? DEFAULT_COUNTRY;

  const [deals, brands] = await Promise.all([
    queryDeals({ country, city: loc?.city ?? undefined, category, limit: 48, sort: 'discount' }),
    distinctBrands(country, category),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <FilterPanel brands={brands} />
      <section>
        <h1 className="mb-6 text-xl font-semibold tracking-tight">{t(category)}</h1>
        <DealGrid deals={deals} />
      </section>
    </div>
  );
}
