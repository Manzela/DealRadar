'use client';

/** Non-blocking first-visit prompt asking to use browser geolocation. */
import { useTranslations } from 'next-intl';
import { useLocation } from '@/components/layout/LocationContext';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';

export function GeoConsentPrompt() {
  const t = useTranslations('geo');
  const { needsGeoConsent, grantGeoConsent, dismissGeoConsent } = useLocation();
  if (!needsGeoConsent) return null;

  return (
    <div
      role="dialog"
      aria-label={t('promptTitle')}
      className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-card-hover"
    >
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
        <div className="flex-1">
          <p className="text-sm font-medium">{t('promptTitle')}</p>
          <p className="mt-1 text-xs text-zinc-500">{t('promptBody')}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={grantGeoConsent}>{t('allow')}</Button>
            <Button size="sm" variant="outline" onClick={dismissGeoConsent}>{t('useIpInstead')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
