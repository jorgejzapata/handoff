import { useEffect, useRef } from 'react'
import { LngLatBounds, Map as MlMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { CSU_CAMPUS } from '../../lib/geo'

// Maps use MapLibre with OpenFreeMap tiles: free, no API key, OpenStreetMap
// data. The basemap is tinted with Handoff's canvas, sage and forest tokens,
// and follows light/dark mode. This file is lazy-loaded (see LazyMap).

setWorkerUrl(workerUrl)

const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}

export interface MapPin {
  id: string
  lat: number
  lng: number
  label: string // e.g. "$650"
}

export interface MapViewProps {
  center?: { lat: number; lng: number }
  zoom?: number
  circle?: { lat: number; lng: number; radiusM: number }
  pins?: MapPin[]
  activePinId?: string | null
  onPinClick?: (id: string) => void
  onMapClick?: () => void
  label: string // accessible description
  className?: string
}

function isDark() {
  const forced = document.documentElement.dataset.theme
  if (forced) return forced === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// Recolor the basemap's background, water and parks with brand tokens.
function tint(map: MlMap) {
  const dark = isDark()
  const canvas = token('--canvas') || (dark ? '#121A15' : '#F8F8F1')
  const sage = token('--sage-100') || (dark ? '#1F2B24' : '#EEF2E7')
  const water = dark ? '#16262A' : '#DCE8E4'
  for (const layer of map.getStyle().layers ?? []) {
    try {
      if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', canvas)
      else if (layer.type === 'fill' && /water/.test(layer.id)) map.setPaintProperty(layer.id, 'fill-color', water)
      else if (layer.type === 'fill' && /park|landcover_grass|landuse_park|wood/.test(layer.id))
        map.setPaintProperty(layer.id, 'fill-color', sage)
    } catch {
      /* layer without that paint property */
    }
  }
}

// A circle on the map as a 64-point polygon (MapLibre circles are in pixels).
function circlePolygon(lat: number, lng: number, radiusM: number) {
  const coords: [number, number][] = []
  const dLat = radiusM / 111_320
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180))
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [coords] } }
}

function addCircle(map: MlMap, circle: NonNullable<MapViewProps['circle']>) {
  const forest = token('--forest-600') || '#3A6447'
  const data = circlePolygon(circle.lat, circle.lng, circle.radiusM)
  const src = map.getSource('area') as GeoJSONSource | undefined
  if (src) {
    src.setData(data)
    return
  }
  map.addSource('area', { type: 'geojson', data })
  map.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': forest, 'fill-opacity': 0.16 } })
  map.addLayer({ id: 'area-line', type: 'line', source: 'area', paint: { 'line-color': forest, 'line-width': 1.5 } })
}

export default function MapView({
  center,
  zoom = 13,
  circle,
  pins,
  activePinId,
  onPinClick,
  onMapClick,
  label,
  className = '',
}: MapViewProps) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<MlMap | null>(null)
  const markers = useRef<Map<string, Marker>>(new Map())
  const circleRef = useRef(circle)
  circleRef.current = circle
  const onPinRef = useRef(onPinClick)
  onPinRef.current = onPinClick
  const onMapRef = useRef(onMapClick)
  onMapRef.current = onMapClick

  // Create the map once.
  useEffect(() => {
    if (!el.current) return
    const start = center ?? circle ?? CSU_CAMPUS
    const m = new MlMap({
      container: el.current,
      style: isDark() ? STYLES.dark : STYLES.light,
      center: [start.lng, start.lat],
      zoom,
      attributionControl: { compact: true },
      cooperativeGestures: !pins, // single maps on scrolling pages need two fingers
      dragRotate: false,
      pitchWithRotate: false,
    })
    m.touchZoomRotate.disableRotation()
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    m.on('style.load', () => {
      tint(m)
      if (circleRef.current) addCircle(m, circleRef.current)
    })
    m.on('click', () => onMapRef.current?.())
    map.current = m

    // Follow light/dark mode changes.
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onScheme = () => m.setStyle(isDark() ? STYLES.dark : STYLES.light)
    mq.addEventListener('change', onScheme)

    return () => {
      mq.removeEventListener('change', onScheme)
      markers.current.forEach((mk) => mk.remove())
      markers.current.clear()
      m.remove()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the circle in sync (e.g. a new address in Post step 5).
  useEffect(() => {
    const m = map.current
    if (!m || !circle) return
    if (m.isStyleLoaded()) addCircle(m, circle)
    m.easeTo({ center: [circle.lng, circle.lat], duration: 400 })
  }, [circle?.lat, circle?.lng, circle?.radiusM]) // eslint-disable-line react-hooks/exhaustive-deps

  // Price pins, as HTML markers so they're real buttons.
  useEffect(() => {
    const m = map.current
    if (!m || !pins) return
    const next = new Set(pins.map((p) => p.id))
    markers.current.forEach((mk, id) => {
      if (!next.has(id)) {
        mk.remove()
        markers.current.delete(id)
      }
    })
    for (const p of pins) {
      let mk: Marker | undefined = markers.current.get(p.id)
      if (!mk) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'map-pin'
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          onPinRef.current?.(p.id)
        })
        const created = new Marker({ element: btn, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(m)
        markers.current.set(p.id, created)
        mk = created
      }
      const node = mk.getElement()
      node.textContent = p.label
      node.setAttribute('aria-label', `${p.label} a month`)
    }
    if (pins.length > 1) {
      const bounds = new LngLatBounds()
      pins.forEach((p) => bounds.extend([p.lng, p.lat]))
      m.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 })
    } else if (pins.length === 1) {
      m.jumpTo({ center: [pins[0].lng, pins[0].lat], zoom: 14 })
    }
  }, [pins])

  useEffect(() => {
    markers.current.forEach((mk, id) => mk.getElement().classList.toggle('active', id === activePinId))
  }, [activePinId, pins])

  return <div ref={el} className={`map-view ${className}`} role="region" aria-label={label} />
}

export { MapView }
