import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const LOCALES = ['en', 'de', 'fr', 'es', 'it', 'pl', 'nl', 'pt', 'sv', 'ro'] as const;
export type Locale = (typeof LOCALES)[number];

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: 'en',
  // Accept-Language auto-detection is on by default in the next-intl middleware.
  localePrefix: 'always', // URL structure: /[locale]/...
});

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
