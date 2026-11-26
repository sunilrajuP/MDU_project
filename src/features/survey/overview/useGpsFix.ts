import { useCallback, useState } from 'react';

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracyM: number;
}

/** On-demand device GPS fix ("Current GPS" on the site map). Never requests permission until `locate` is called. */
export function useGpsFix() {
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [error, setError] = useState<string>();

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Location is not available on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setError(undefined);
        setFix({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: Math.round(position.coords.accuracy),
        });
      },
      () => setError('Your location could not be read. Check location permission and try again.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  return { fix, error, locate };
}
