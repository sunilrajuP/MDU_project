import { baseApi } from './baseApi';
import type { AddressSuggestion } from '@/types/api';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const AU_BBOX = '112.9,-43.8,153.7,-9.0'; // minLon,minLat,maxLon,maxLat
const MELBOURNE = { lat: -37.8136, lon: 144.9631 };

const STATE_ABBR: Record<string, string> = {
  Victoria: 'VIC',
  'New South Wales': 'NSW',
  Queensland: 'QLD',
  'South Australia': 'SA',
  'Western Australia': 'WA',
  Tasmania: 'TAS',
  'Northern Territory': 'NT',
  'Australian Capital Territory': 'ACT',
};

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countrycode?: string;
  };
}

function toSuggestion(f: PhotonFeature): AddressSuggestion | null {
  const p = f.properties;
  const primary = p.street ? [p.housenumber, p.street].filter(Boolean).join(' ') : p.name;
  if (!primary) return null;

  const suburb = p.locality ?? p.district ?? p.city ?? '';
  const isAU = p.countrycode === 'AU';
  const state = isAU ? STATE_ABBR[p.state ?? ''] ?? p.state ?? '' : p.state ?? '';
  const secondary = [[suburb, state, p.postcode].filter(Boolean).join(' '), isAU ? '' : p.country]
    .filter(Boolean)
    .join(', ');

  return {
    id: `${p.osm_type ?? 'x'}-${p.osm_id ?? primary}-${secondary}`,
    primary,
    secondary,
    full: secondary ? `${primary}, ${secondary}` : primary,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    countryCode: p.countrycode ?? '',
  };
}

async function query(q: string, australiaOnly: boolean, signal: AbortSignal) {
  const params = new URLSearchParams({ q, limit: '8', lang: 'en' });
  if (australiaOnly) {
    params.set('bbox', AU_BBOX);
    params.set('lat', String(MELBOURNE.lat));
    params.set('lon', String(MELBOURNE.lon));
  }
  const res = await fetch(`${PHOTON_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Address search failed (${res.status})`);
  const json = (await res.json()) as { features: PhotonFeature[] };

  const seen = new Set<string>();
  return json.features
    .filter((f) => !australiaOnly || f.properties.countrycode === 'AU')
    .map(toSuggestion)
    .filter((s): s is AddressSuggestion => {
      if (!s || seen.has(s.full)) return false;
      seen.add(s.full);
      return true;
    });
}

/** Australia first; worldwide only if Australia has nothing. */
async function searchAddresses(q: string, signal: AbortSignal) {
  let results = await query(q, true, signal);
  if (results.length === 0) results = await query(q, false, signal);
  return results;
}

const addressApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    searchAddresses: builder.query<AddressSuggestion[], string>({
      async queryFn(query, { signal }) {
        try {
          return { data: await searchAddresses(query, signal) };
        } catch (failure) {
          return {
            error: {
              status: 0,
              message: failure instanceof Error ? failure.message : 'Address search failed.',
            },
          };
        }
      },
    }),
  }),
});

export const { useLazySearchAddressesQuery } = addressApi;