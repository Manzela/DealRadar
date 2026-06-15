/**
 * GET /api/geo            → IP-based lookup (ipapi.co, server-side only)
 * GET /api/geo?lat=&lon=  → reverse lookup for browser geolocation coords
 *
 * Privacy: the client IP is forwarded to ipapi.co from the server; no
 * third-party request ever originates in the user's browser. Coordinates are
 * used transiently and never stored server-side.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isSupportedCountry, DEFAULT_COUNTRY } from '@/lib/geo/countries';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat');
  const lon = req.nextUrl.searchParams.get('lon');

  try {
    if (lat && lon) {
      // ipapi.co has no reverse-geocode endpoint; use BigDataCloud's free
      // client API (no key required) server-side for coords → country/city.
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`,
        { next: { revalidate: 3600 } },
      );
      if (res.ok) {
        const d = (await res.json()) as { countryCode?: string; city?: string };
        const country = (d.countryCode ?? '').toUpperCase();
        const supported = isSupportedCountry(country);
        return NextResponse.json({
          // City belongs to the resolved country; when that country isn't
          // supported we fall back to the default, so the city is dropped too.
          country: supported ? country : DEFAULT_COUNTRY,
          city: supported ? d.city || null : null,
        });
      }
    }

    // IP path. Honour proxy headers (Vercel/NGINX) for the real client IP.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const url = ip && ip !== '127.0.0.1' && ip !== '::1'
      ? `https://ipapi.co/${ip}/json/`
      : 'https://ipapi.co/json/'; // local dev: resolve the server's own IP
    const res = await fetch(url, {
      headers: { 'User-Agent': 'dealradar/1.0' },
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const d = (await res.json()) as { country_code?: string; city?: string };
      const country = (d.country_code ?? '').toUpperCase();
      const supported = isSupportedCountry(country);
      return NextResponse.json({
        // City belongs to the resolved country; when that country isn't
        // supported we fall back to the default, so the city is dropped too.
        country: supported ? country : DEFAULT_COUNTRY,
        city: supported ? d.city || null : null,
      });
    }
  } catch (e) {
    console.error('[api/geo]', e);
  }
  return NextResponse.json({ country: DEFAULT_COUNTRY, city: null });
}
