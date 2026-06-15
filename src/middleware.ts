/**
 * next-intl middleware: locale detection (cookie → Accept-Language → default)
 * and /[locale]/ prefixing. The geo cookie (dr_location) is read by pages
 * directly via cookies(); nothing geo-related is needed here.
 */
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals and static files.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
