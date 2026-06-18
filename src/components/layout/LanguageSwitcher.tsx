'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { LOCALES } from '@/i18n/routing';
import { Globe } from 'lucide-react';

const LABELS: Record<string, string> = {
  en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano',
  pl: 'Polski', nl: 'Nederlands', pt: 'Português', sv: 'Svenska', ro: 'Română',
  da: 'Dansk', fi: 'Suomi', no: 'Norsk',
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className="flex items-center gap-1.5 text-sm text-zinc-700">
      <Globe className="h-4 w-4 text-zinc-400" aria-hidden />
      <span className="sr-only">Language</span>
      <select
        value={locale}
        onChange={(e) => router.replace(pathname, { locale: e.target.value })}
        className="h-8 cursor-pointer rounded-lg border-none bg-transparent pr-1 text-sm hover:bg-zinc-100"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>{LABELS[l]}</option>
        ))}
      </select>
    </label>
  );
}
