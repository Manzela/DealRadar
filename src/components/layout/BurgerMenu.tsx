'use client';

/**
 * Burger menu → slide-in drawer (mobile + desktop). Full category tree with
 * subcategories and brand filters; brands load lazily per category from
 * /api/brands so the menu reflects live deal data.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Menu, X, ChevronRight } from 'lucide-react';
import { CATEGORIES } from '@/lib/categories';
import { useLocation } from './LocationContext';
import type { CategorySlug } from '@/lib/providers/types';

export function BurgerMenu() {
  const t = useTranslations();
  const { location } = useLocation();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<CategorySlug | null>(null);
  const [brands, setBrands] = useState<Record<string, string[]>>({});
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

  // Dedicated portal container appended to <body>. Portaling into a node that
  // React does not own (rather than document.body directly) avoids scheduling
  // updates on Next's dev HotReload while this component renders.
  useEffect(() => {
    const el = document.createElement('div');
    el.setAttribute('data-burger-menu', '');
    document.body.appendChild(el);
    setPortalEl(el);
    return () => { document.body.removeChild(el); };
  }, []);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const toggleCategory = async (slug: CategorySlug) => {
    const next = expanded === slug ? null : slug;
    setExpanded(next);
    if (next && !brands[next]) {
      try {
        const res = await fetch(`/api/brands?country=${location.country}&category=${next}`);
        if (res.ok) {
          const data = (await res.json()) as { brands: string[] };
          setBrands((b) => ({ ...b, [next]: data.brands.slice(0, 12) }));
        }
      } catch { /* menu still works without brands */ }
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t('nav.openMenu')}
        className="rounded-lg p-2 text-zinc-700 hover:bg-zinc-100"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {open && portalEl && createPortal(
        // Portal out of the header: its `backdrop-blur` creates a containing
        // block for fixed descendants, which would otherwise clip this overlay
        // to the header's height.
        <div className="fixed inset-0 z-50">
          <button
            aria-label={t('nav.closeMenu')}
            className="absolute inset-0 bg-zinc-900/30"
            onClick={() => setOpen(false)}
          />
          <nav
            aria-label={t('categories.heading')}
            className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-white p-4 shadow-card-hover"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold">{t('categories.heading')}</span>
              <button
                onClick={() => setOpen(false)}
                aria-label={t('nav.closeMenu')}
                className="rounded-lg p-1.5 hover:bg-zinc-100"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <ul className="space-y-1">
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <div className="flex items-center">
                    <Link
                      href={`/category/${c.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex-1 rounded-lg px-2 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                    >
                      {t(`categories.${c.slug}`)}
                    </Link>
                    <button
                      onClick={() => toggleCategory(c.slug)}
                      aria-expanded={expanded === c.slug}
                      aria-label={`${t(`categories.${c.slug}`)} — ${t('nav.subcategories')}`}
                      className="rounded-lg p-2 hover:bg-zinc-50"
                    >
                      <ChevronRight
                        className={`h-4 w-4 text-zinc-400 transition-transform ${expanded === c.slug ? 'rotate-90' : ''}`}
                        aria-hidden
                      />
                    </button>
                  </div>

                  {expanded === c.slug && (
                    <div className="ml-3 border-l border-zinc-100 pl-3">
                      <ul className="space-y-0.5 py-1">
                        {c.subcategories.map((sub) => (
                          <li key={sub}>
                            <Link
                              href={`/search?q=${encodeURIComponent(sub)}&category=${c.slug}`}
                              onClick={() => setOpen(false)}
                              className="block rounded-lg px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
                            >
                              {sub}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {brands[c.slug] && brands[c.slug].length > 0 && (
                        <>
                          <p className="px-2 pt-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                            {t('nav.brands')}
                          </p>
                          <ul className="flex flex-wrap gap-1.5 px-2 py-2">
                            {brands[c.slug].map((b) => (
                              <li key={b}>
                                <Link
                                  href={`/search?brand=${encodeURIComponent(b)}&category=${c.slug}`}
                                  onClick={() => setOpen(false)}
                                  className="inline-block rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-accent-soft hover:text-accent"
                                >
                                  {b}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>,
        portalEl,
      )}
    </>
  );
}
