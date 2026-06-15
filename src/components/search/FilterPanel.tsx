'use client';

/**
 * Results-page filters: category, brand, price range, min discount, sort.
 * State lives in the URL (searchParams) so results are shareable and SSR'd.
 * Native inputs only — keeps the bundle small for the Lighthouse target.
 */
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { CATEGORIES } from '@/lib/categories';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function FilterPanel({ brands, category }: { brands: string[]; category?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [minPrice, setMinPrice] = useState(params.get('minPrice') ?? '');
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') ?? '');
  const [minDiscount, setMinDiscount] = useState(Number(params.get('minDiscount') ?? 0));

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  };

  // Category lives in the route (/category/<slug>), not a query param, so
  // changing it must navigate. "All categories" falls back to /search.
  const goToCategory = (slug: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete('category');
    const qs = next.toString();
    const suffix = qs ? `?${qs}` : '';
    router.push(slug ? `/category/${slug}${suffix}` : `/search${suffix}`);
  };

  const applyPrices = () => {
    const next = new URLSearchParams(params.toString());
    minPrice ? next.set('minPrice', minPrice) : next.delete('minPrice');
    maxPrice ? next.set('maxPrice', maxPrice) : next.delete('maxPrice');
    next.set('minDiscount', String(minDiscount));
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <aside aria-label={t('filters.heading')} className="space-y-5">
      <div>
        <label htmlFor="f-sort" className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {t('filters.sort')}
        </label>
        <select
          id="f-sort"
          value={params.get('sort') ?? 'discount'}
          onChange={(e) => setParam('sort', e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm"
        >
          <option value="discount">{t('filters.sortDiscount')}</option>
          <option value="price-asc">{t('filters.sortPriceAsc')}</option>
          <option value="price-desc">{t('filters.sortPriceDesc')}</option>
          <option value="newest">{t('filters.sortNewest')}</option>
        </select>
      </div>

      <div>
        <label htmlFor="f-category" className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {t('filters.category')}
        </label>
        <select
          id="f-category"
          value={category ?? params.get('category') ?? ''}
          onChange={(e) => goToCategory(e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm"
        >
          <option value="">{t('filters.allCategories')}</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>{t(`categories.${c.slug}`)}</option>
          ))}
        </select>
      </div>

      {brands.length > 0 && (
        <div>
          <label htmlFor="f-brand" className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {t('filters.brand')}
          </label>
          <select
            id="f-brand"
            value={params.get('brand') ?? ''}
            onChange={(e) => setParam('brand', e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm"
          >
            <option value="">{t('filters.allBrands')}</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      )}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t('filters.priceRange')}</p>
        <div className="mt-1 flex items-center gap-2">
          <Input
            inputMode="numeric" placeholder={t('filters.min')} value={minPrice}
            onChange={(e) => setMinPrice(e.target.value.replace(/[^\d.]/g, ''))}
            aria-label={t('filters.min')}
          />
          <span className="text-zinc-400">–</span>
          <Input
            inputMode="numeric" placeholder={t('filters.max')} value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d.]/g, ''))}
            aria-label={t('filters.max')}
          />
        </div>
      </div>

      <div>
        <label htmlFor="f-discount" className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {t('filters.minDiscount')}: <span className="font-semibold text-zinc-700">{minDiscount}%</span>
        </label>
        <input
          id="f-discount"
          type="range" min={0} max={90} step={5} value={minDiscount}
          onChange={(e) => setMinDiscount(Number(e.target.value))}
          className="mt-2 w-full accent-accent"
        />
      </div>

      <Button className="w-full" size="sm" onClick={applyPrices}>{t('filters.apply')}</Button>
    </aside>
  );
}
