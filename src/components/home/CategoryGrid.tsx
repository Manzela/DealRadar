import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { CATEGORIES } from '@/lib/categories';
import {
  MonitorSmartphone, Shirt, Sofa, Bike, Sparkles,
  ShoppingBasket, Blocks, Car, BookOpen, Plane, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  MonitorSmartphone, Shirt, Sofa, Bike, Sparkles, ShoppingBasket, Blocks, Car, BookOpen, Plane,
};

export function CategoryGrid() {
  const t = useTranslations('categories');

  return (
    <section aria-labelledby="categories-heading" className="mt-12">
      <h2 id="categories-heading" className="mb-6 text-xl font-semibold tracking-tight">
        {t('heading')}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CATEGORIES.map((c) => {
          const Icon = ICONS[c.icon];
          return (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="group flex flex-col items-center gap-2 rounded-lg border border-zinc-100 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent-soft hover:shadow-card-hover"
            >
              <Icon className="h-6 w-6 text-accent" aria-hidden />
              <span className="text-center text-sm font-medium text-zinc-700 group-hover:text-zinc-900">
                {t(c.slug)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
