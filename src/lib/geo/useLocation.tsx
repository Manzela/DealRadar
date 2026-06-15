'use client';
/**
 * Location context: holds resolved {country, city}, persists to
 * localStorage + cookie (cookie → SSR scoping in server components).
 * Resolution order: stored value → browser geolocation (after consent,
 * see GeoConsentPrompt) → /api/geo IP fallback → default.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CountryCode } from '@/lib/providers/types';
import { DEFAULT_COUNTRY } from '@/lib/geo/countries';

export interface LocationState {
  country: CountryCode;
  city: string | null;
  resolved: boolean; // false until first resolution completes
}

interface LocationContextValue extends LocationState {
  setLocation: (country: CountryCode, city: string | null) => void;
  resolveViaIp: () => Promise<void>;
  resolveViaBrowser: () => Promise<boolean>;
}

const LocationContext = createContext<LocationContextValue | null>(null);
const STORAGE_KEY = 'dealradar.location';
export const LOCATION_COOKIE = 'dr_loc';

function persist(country: CountryCode, city: string | null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ country, city }));
    // 180 days; SameSite=Lax; path=/ so SSR pages can scope queries.
    document.cookie = `${LOCATION_COOKIE}=${country}|${encodeURIComponent(city ?? '')};path=/;max-age=15552000;SameSite=Lax`;
  } catch { /* private mode etc. — non-fatal */ }
}

export function LocationProvider({ children, initial }: { children: ReactNode; initial?: Partial<LocationState> }) {
  const [state, setState] = useState<LocationState>({
    country: initial?.country ?? DEFAULT_COUNTRY,
    city: initial?.city ?? null,
    resolved: Boolean(initial?.country),
  });

  const setLocation = useCallback((country: CountryCode, city: string | null) => {
    setState({ country, city, resolved: true });
    persist(country, city);
  }, []);

  const resolveViaIp = useCallback(async () => {
    try {
      const res = await fetch('/api/geo');
      const data = (await res.json()) as { country: CountryCode; city: string | null };
      setLocation(data.country, data.city);
    } catch {
      setLocation(DEFAULT_COUNTRY, null);
    }
  }, [setLocation]);

  const resolveViaBrowser = useCallback(async (): Promise<boolean> => {
    if (!('geolocation' in navigator)) return false;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async () => {
          // Browser gives coordinates only; we still need country/city.
          // Reverse-geocoding coords would need another external service, so we
          // use the IP path for the actual mapping — the permission grant
          // signals user consent to locate.
          await resolveViaIp();
          resolve(true);
        },
        () => resolve(false),
        { timeout: 5000, maximumAge: 600000 },
      );
    });
  }, [resolveViaIp]);

  // Restore persisted location on mount (overrides SSR default).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { country, city } = JSON.parse(raw) as { country: CountryCode; city: string | null };
        setState({ country, city, resolved: true });
        return;
      }
    } catch { /* ignore */ }
    // No stored value → GeoConsentPrompt will drive resolution.
  }, []);

  return (
    <LocationContext.Provider value={{ ...state, setLocation, resolveViaIp, resolveViaBrowser }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside <LocationProvider>');
  return ctx;
}
