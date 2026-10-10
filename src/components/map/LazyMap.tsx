import { Component, Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import type { MapViewProps } from './MapView'

// The map library is big, so it loads only when a map is on screen.
const MapView = lazy(() => import('./MapView'))

// If the map can't load (offline, no WebGL), fall back to the plain circle.
class MapBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function LazyMap(props: MapViewProps) {
  const fallback = (
    <div className={`map ${props.className ?? ''}`} role="img" aria-label={props.label}>
      {props.circle && <div className="map-circle" />}
    </div>
  )
  return (
    <MapBoundary fallback={fallback}>
      <Suspense fallback={<div className={`map map-loading ${props.className ?? ''}`} aria-busy="true" />}>
        <MapView {...props} />
      </Suspense>
    </MapBoundary>
  )
}

// About a quarter mile: the public "approximate area" circle.
export const AREA_RADIUS_M = 400
