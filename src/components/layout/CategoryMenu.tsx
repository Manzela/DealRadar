'use client';

/**
 * Full-width "Browse by category" bar at the top of the page. Click it and a
 * category panel slides down, overlaying the content below; pick a category to
 * jump to its page. Replaces the old burger drawer.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { CATEGORIES } from '@/lib/categories';
import {
  ChevronDown, MonitorSmartphone, Shirt, Sofa, Bike, Sparkles,
  ShoppingBasket, Blocks, Car, BookOpen, Plane, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  MonitorSmartphone, Shirt, Sofa, Bike, Sparkles, ShoppingBasket, Blocks, Car, BookOpen, Plane,
};

/** Column of 3 down-chevrons that light up top→bottom as a "push to open" hint. */
function ChevronStack({ animate }: { animate: boolean }) {
  return (
    <span className="flex flex-col items-center -space-y-2 text-zinc-400" aria-hidden>
      {[0, 1, 2].map((i) => (
        <ChevronDown
          key={i}
          className={`h-4 w-7 ${animate ? 'animate-chevron-hint' : ''}`}
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}

export function CategoryMenu() {
  const t = useTranslations('categories');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative z-30 mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-12 w-full items-center justify-center gap-4 rounded-lg border border-zinc-200 bg-white text-base font-medium text-zinc-700 shadow-card transition-colors hover:border-accent-soft hover:bg-accent-soft hover:text-accent"
      >
        <ChevronStack animate={!open} />
        <span className="text-center">{t('heading')}</span>
        <ChevronStack animate={!open} />
      </button>

      <div
        className={`absolute left-0 right-0 top-full z-40 mt-2 origin-top rounded-xl border border-zinc-200 bg-white p-4 shadow-card-hover transition-all duration-200 ${
          open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'
        }`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c) => {
            const Icon = ICONS[c.icon];
            return (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                onClick={() => setOpen(false)}
                className="group flex flex-col items-center gap-2 rounded-lg border border-zinc-100 bg-white p-4 transition-colors hover:border-accent-soft hover:bg-accent-soft"
              >
                <Icon className="h-6 w-6 text-accent" aria-hidden />
                <span className="text-center text-sm font-medium text-zinc-700 group-hover:text-accent">
                  {t(c.slug)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
