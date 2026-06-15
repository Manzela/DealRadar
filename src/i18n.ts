/**
 * next-intl request config. Stub locales fall back to English by deep-merging
 * en.json under the locale file, so partially translated locales never crash.
 */
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LOCALES, type Locale } from '@/lib/i18n/config';

export default getRequestConfig(async ({ locale }) => {
  if (!LOCALES.includes(locale as Locale)) notFound();
  const fallback = (await import('./messages/en.json')).default;
  const messages = (await import(`./messages/${locale}.json`)).default;
  return { messages: deepMerge(fallback, messages) };
});

function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v)
      ? deepMerge((base[k] ?? {}) as Record<string, unknown>, v as Record<string, unknown>)
      : v;
  }
  return out as T;
}
