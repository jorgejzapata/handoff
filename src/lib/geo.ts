// Address search and location privacy.
//
// Search uses Photon (photon.komoot.io), a free OpenStreetMap geocoder with no
// API key. It's fair-use, which is fine at one campus; swap in a paid geocoder
// (Google Places, Mapbox) if usage grows.

// CSU main campus, near the Lory Student Center. Moves to schools/{schoolId} later.
export const CSU_CAMPUS = { lat: 40.5734, lng: -105.0843 }

// Fort Collins area, so suggestions stay local.
const BBOX = '-105.25,40.45,-104.95,40.68'

export interface AddressResult {
  label: string // "1234 Elizabeth St, Fort Collins"
  streetAddress: string
  neighborhood: string
  lat: number
  lng: number
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    housenumber?: string
    street?: string
    city?: string
    district?: string
    locality?: string
    suburb?: string
    postcode?: string
    type?: string
  }
}

export async function searchAddress(q: string, signal?: AbortSignal): Promise<AddressResult[]> {
  const text = q.trim()
  if (text.length < 4) return []
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}` +
    `&lat=${CSU_CAMPUS.lat}&lon=${CSU_CAMPUS.lng}&bbox=${BBOX}&limit=6&lang=en`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Address search failed (${res.status})`)
  const json = (await res.json()) as { features: PhotonFeature[] }
  const seen = new Set<string>()
  return json.features
    .map((f) => {
      const p = f.properties
      const street = [p.housenumber, p.street ?? (p.type === 'street' ? p.name : undefined)].filter(Boolean).join(' ')
      const streetAddress = street || p.name || ''
      const city = p.city ?? 'Fort Collins'
      return {
        label: [streetAddress, city].filter(Boolean).join(', '),
        streetAddress,
        neighborhood: p.district ?? p.suburb ?? p.locality ?? '',
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }
    })
    .filter((r) => r.streetAddress && !seen.has(r.label) && seen.add(r.label))
}

// Rounds to roughly a 500 m grid, so the public pin never points at the building.
export function approximate(lat: number, lng: number) {
  const step = 0.005
  return { lat: Math.round(lat / step) * step, lng: Math.round(lng / step) * step }
}

export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Distance from the exact address (more accurate), rounded to 0.1 mi.
export function distanceToCampusMi(lat: number, lng: number) {
  return Math.round(milesBetween({ lat, lng }, CSU_CAMPUS) * 10) / 10
}
