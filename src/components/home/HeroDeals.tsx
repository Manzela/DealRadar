import { getTranslations } from 'next-intl/server';
import { DealGrid } from '@/components/deals/DealGrid';
import { queryDeals } from '@/lib/db/deals.repo';
import { countryInfo } from '@/lib/geo/countries';
import type { CountryCode } from '@/lib/providers/types';

/** Hero: top 12 deals in the user's country by discount % (server-rendered). */
export async function HeroDeals({ country, city }: { country: CountryCode; city: string | null }) {
  const t = await getTranslations('home');
  const deals = await queryDeals({ country, city: city ?? undefined, limit: 12, sort: 'discount' });

  return (
    <section aria-labelledby="hero-heading">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 id="hero-heading" className="text-2xl font-semibold tracking-tight">
          {t('topDeals', { country: countryInfo(country).name })}
        </h1>
      </div>
      {deals.length > 0 ? (
        <DealGrid deals={deals} />
      ) : (
        <p className="rounded-lg border border-dashed border-zinc-200 p-10 text-center text-zinc-500">
          {t('noDeals')}
        </p>
      )}
    </section>
  );
}
