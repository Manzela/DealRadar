'use client';

/**
 * Lightweight custom GDPR cookie banner — no third-party consent SDK.
 * Essential cookies (locale, location) are always on; the only optional
 * category in v1 is anonymous analytics (not yet wired — the flag is stored
 * so an analytics script can honour it later).
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

const CONSENT_KEY = 'dealradar.consent'; // 'all' | 'essential'

export function getConsent(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(CONSENT_KEY);
}

export function CookieBanner() {
  const t = useTranslations('gdpr');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getConsent() === null);
  }, []);

  if (!visible) return null;

  const decide = (value: 'all' | 'essential') => {
    window.localStorage.setItem(CONSENT_KEY, value);
    document.cookie = `dr_consent=${value}; path=/; max-age=${365 * 24 * 3600}; SameSite=Lax`;
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label={t('bannerTitle')}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white p-4 shadow-[0_-4px_12px_-4px_rgb(0_0_0/0.08)]"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-sm font-medium">{t('bannerTitle')}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{t('bannerBody')}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => decide('essential')}>
            {t('essentialOnly')}
          </Button>
          <Button size="sm" onClick={() => decide('all')}>{t('acceptAll')}</Button>
        </div>
      </div>
    </div>
  );
}
