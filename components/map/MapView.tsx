'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import Map, { MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { RoutePin, Route } from '@/types/route'
import PinLayer from './PinLayer'
import RouteLayer from './RouteLayer'
import RoutePopup from './RoutePopup'
import SearchControl from './SearchControl'
import LocationControl from './LocationControl'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

// Sydney, AU
const INITIAL_VIEW = { longitude: 151.2093, latitude: -33.8688, zoom: 11 }

export default function MapView() {
  const mapRef = useRef<MapRef>(null)
  const [pins, setPins] = useState<RoutePin[]>([])
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  const [loadingRoute, setLoadingRoute] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPins = useCallback(async () => {
    const map = mapRef.current
    if (!map) return
    const bounds = map.getBounds()
    const params = new URLSearchParams({
      west: bounds.getWest().toString(),
      south: bounds.getSouth().toString(),
      east: bounds.getEast().toString(),
      north: bounds.getNorth().toString(),
    })
    try {
      const res = await fetch(`/api/routes?${params}`)
      const data: RoutePin[] = await res.json()
      setPins((prev) => {
        const existing = new Set(prev.map((p) => p.id))
        const newPins = data.filter((p) => !existing.has(p.id))
        return newPins.length ? [...prev, ...newPins] : prev
      })
    } catch {
      // silently ignore network errors during panning
    }
  }, [])

  const onMapMove = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fetchPins, 300)
  }, [fetchPins])

  // Initial load
  useEffect(() => {
    fetchPins()
  }, [fetchPins])

  const handlePinClick = useCallback(async (id: string) => {
    setLoadingRoute(true)
    try {
      const res = await fetch(`/api/routes/${id}`)
      const route: Route = await res.json()
      setSelectedRoute(route)
    } finally {
      setLoadingRoute(false)
    }
  }, [])

  const handleDeselect = useCallback(() => setSelectedRoute(null), [])

  return (
    <div className="relative w-screen h-screen">
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE}
        initialViewState={INITIAL_VIEW}
        onMoveEnd={onMapMove}
        onClick={(e) => {
          // Deselect if clicking empty map (not a pin — pin clicks are handled in PinLayer)
          const features = e.features ?? []
          if (features.length === 0) handleDeselect()
        }}
        interactiveLayerIds={['pins']}
        style={{ width: '100%', height: '100%' }}
      >
        <PinLayer pins={pins} onPinClick={handlePinClick} selectedId={selectedRoute?.id ?? null} />
        {selectedRoute && <RouteLayer route={selectedRoute} />}
        {selectedRoute && (
          <RoutePopup
            route={selectedRoute}
            onClose={handleDeselect}
            onRouteRemoved={(id) => {
              setPins((prev) => prev.filter((p) => p.id !== id))
              setSelectedRoute(null)
            }}
          />
        )}
        <SearchControl mapRef={mapRef} />
        <LocationControl mapRef={mapRef} />
      </Map>

      {/* Upload CTA */}
      <a
        href="/upload"
        className="absolute bottom-8 right-4 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-full shadow-lg text-sm transition-colors"
      >
        + Upload Route
      </a>

      {loadingRoute && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 rounded-full px-4 py-2 text-sm font-medium shadow">Loading route…</div>
        </div>
      )}
    </div>
  )
}
