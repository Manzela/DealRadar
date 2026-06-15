/**
 * Geolocation resolution chain (client side):
 *   1. previously stored location (localStorage / cookie) — instant,
 *   2. browser Geolocation API (only after explicit consent — GDPR),
 *   3. IP fallback via our server route /api/geo (which calls ipapi.co
 *      server-side, so no third-party call ever happens from the browser).
 *
 * The resolved location is persisted to BOTH localStorage (client reads) and a
 * cookie (SSR reads in layout/pages).
 */
import { DEFAULT_COUNTRY, isSupportedCountry } from './countries';
import type { CountryCode } from '../providers/types';

export interface ResolvedLocation {
  country: CountryCode;
  city: string | null;
  /** How we got it — shown nowhere, useful for debugging. */
  via: 'stored' | 'browser' | 'ip' | 'default';
}

export const LOCATION_COOKIE = 'dr_location';
const LOCATION_LS_KEY = 'dealradar.location';

export function readStoredLocation(): ResolvedLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCATION_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResolvedLocation;
    return isSupportedCountry(parsed.country) ? { ...parsed, via: 'stored' } : null;
  } catch {
    return null;
  }
}

export function persistLocation(loc: ResolvedLocation): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCATION_LS_KEY, JSON.stringify(loc));
  // 180-day cookie, Lax, root path — read server-side for SSR scoping.
  const value = encodeURIComponent(`${loc.country}|${loc.city ?? ''}`);
  document.cookie = `${LOCATION_COOKIE}=${value}; path=/; max-age=${180 * 24 * 3600}; SameSite=Lax`;
}

export function parseLocationCookie(raw: string | undefined): ResolvedLocation | null {
  if (!raw) return null;
  const [country, city] = decodeURIComponent(raw).split('|');
  return isSupportedCountry(country) ? { country, city: city || null, via: 'stored' } : null;
}

/** Browser geolocation → reverse lookup via our own /api/geo?lat=&lon=. */
export async function resolveViaBrowser(): Promise<ResolvedLocation | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return null;
  const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null), // denied or unavailable → caller falls back to IP
      { timeout: 8000, maximumAge: 600000 },
    );
  });
  if (!coords) return null;
  const res = await fetch(`/api/geo?lat=${coords.latitude}&lon=${coords.longitude}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { country?: string; city?: string | null };
  if (!data.country || !isSupportedCountry(data.country)) return null;
  return { country: data.country, city: data.city ?? null, via: 'browser' };
}

export async function resolveViaIp(): Promise<ResolvedLocation | null> {
  const res = await fetch('/api/geo');
  if (!res.ok) return null;
  const data = (await res.json()) as { country?: string; city?: string | null };
  if (!data.country || !isSupportedCountry(data.country)) return null;
  return { country: data.country, city: data.city ?? null, via: 'ip' };
}

export function defaultLocation(): ResolvedLocation {
  return { country: DEFAULT_COUNTRY, city: null, via: 'default' };
}
