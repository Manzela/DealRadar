/** i18n configuration — locale list shared by middleware, plugin and switcher. */
export const LOCALES = ['en', 'de', 'fr', 'es', 'it', 'pl', 'nl', 'pt', 'sv', 'ro'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
