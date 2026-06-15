'use client';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

/**
 * Transparency requirement: every affiliate link carries this visible badge.
 * Do not remove or hide — GDPR/consumer-protection constraint.
 */
export function SponsoredBadge() {
  const t = useTranslations('deals');
  return <Badge className="bg-gray-100 text-gray-500">{t('sponsored')}</Badge>;
}
