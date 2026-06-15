import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Footer() {
  const t = useTranslations('footer');
  return (
    <footer className="mt-16 border-t border-zinc-100 bg-zinc-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} DealRadar · {t('affiliateDisclosure')}</p>
        <div className="sm:hidden"><LanguageSwitcher /></div>
      </div>
    </footer>
  );
}
