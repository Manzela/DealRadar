'use client';

/**
 * Client-side location state. Initialized from the SSR cookie value (passed by
 * the locale layout). On first visit (no stored location) it shows the
 * GeoConsentPrompt; consent → browser geolocation, dismiss/deny → IP fallback.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  defaultLocation, persistLocation, readStoredLocation,
  resolveViaBrowser, resolveViaIp, type ResolvedLocation,
} from '@/lib/geo/resolve';

interface LocationContextValue {
  location: ResolvedLocation;
  setLocation: (loc: ResolvedLocation) => void;
  /** True while the first-visit consent prompt should be visible. */
  needsGeoConsent: boolean;
  grantGeoConsent: () => Promise<void>;
  dismissGeoConsent: () => Promise<void>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({
  initial,
  children,
}: {
  initial: ResolvedLocation | null;
  children: ReactNode;
}) {
  const [location, setLocationState] = useState<ResolvedLocation>(initial ?? defaultLocation());
  const [needsGeoConsent, setNeedsGeoConsent] = useState(false);

  // First visit: nothing from SSR cookie and nothing in localStorage → prompt.
  useEffect(() => {
    if (initial) return;
    const stored = readStoredLocation();
    if (stored) {
      setLocationState(stored);
      persistLocation(stored); // re-sync cookie in case it expired
    } else {
      setNeedsGeoConsent(true);
    }
  }, [initial]);

  const setLocation = (loc: ResolvedLocation) => {
    setLocationState(loc);
    persistLocation(loc);
    // Location scoping happens server-side → refresh server components.
    window.location.reload();
  };

  const finishWith = async (loc: ResolvedLocation | null) => {
    setNeedsGeoConsent(false);
    const resolved = loc ?? (await resolveViaIp()) ?? defaultLocation();
    setLocationState(resolved);
    persistLocation(resolved);
    window.location.reload();
  };

  return (
    <LocationContext.Provider
      value={{
        location,
        setLocation,
        needsGeoConsent,
        grantGeoConsent: async () => finishWith(await resolveViaBrowser()),
        dismissGeoConsent: async () => finishWith(null),
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside <LocationProvider>');
  return ctx;
}
