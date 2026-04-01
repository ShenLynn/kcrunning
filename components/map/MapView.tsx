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

const MAP_STYLE = process.env.NEXT_PUBLIC_MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`
  : 'https://tiles.openfreemap.org/styles/liberty'

// Sydney, AU
const INITIAL_VIEW = { longitude: 151.2093, latitude: -33.8688, zoom: 11 }

export default function MapView() {
  const mapRef = useRef<MapRef>(null)
  const [pins, setPins] = useState<RoutePin[]>([])
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  const [popupOpen, setPopupOpen] = useState(false)
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [loadingPins, setLoadingPins] = useState(true)
  const [emptyViewport, setEmptyViewport] = useState(false)
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
    setLoadingPins(true)
    try {
      const res = await fetch(`/api/routes?${params}`)
      const data: RoutePin[] = await res.json()
      setPins((prev) => {
        const existing = new Set(prev.map((p) => p.id))
        const newPins = data.filter((p) => !existing.has(p.id))
        const next = newPins.length ? [...prev, ...newPins] : prev
        setEmptyViewport(next.length === 0)
        return next
      })
    } catch {
      // silently ignore network errors during panning
    } finally {
      setLoadingPins(false)
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
    // Clicking the already-selected pin toggles the popup
    if (selectedRoute?.id === id) {
      setPopupOpen((open) => !open)
      return
    }
    setLoadingRoute(true)
    try {
      const res = await fetch(`/api/routes/${id}`)
      const route: Route = await res.json()
      setSelectedRoute(route)
      setPopupOpen(true)
    } finally {
      setLoadingRoute(false)
    }
  }, [selectedRoute])

  // Close popup but keep polyline on map
  const handleClosePopup = useCallback(() => setPopupOpen(false), [])

  // Clear everything — polyline and popup
  const handleDeselect = useCallback(() => {
    setSelectedRoute(null)
    setPopupOpen(false)
  }, [])

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
        {selectedRoute && popupOpen && (
          <RoutePopup
            route={selectedRoute}
            onClose={handleClosePopup}
            onRouteRemoved={(id) => {
              setPins((prev) => prev.filter((p) => p.id !== id))
              setSelectedRoute(null)
              setPopupOpen(false)
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

      {/* Pin loading indicator */}
      {loadingPins && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-white/90 rounded-full px-3 py-1.5 text-xs font-medium shadow flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            Loading routes…
          </div>
        </div>
      )}

      {/* Empty viewport nudge */}
      {!loadingPins && emptyViewport && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-white/90 rounded-xl px-4 py-2.5 text-sm shadow text-gray-500 text-center">
            No routes here yet —{' '}
            <a href="/upload" className="text-red-600 font-medium pointer-events-auto hover:underline">
              be the first to upload one
            </a>
          </div>
        </div>
      )}

      {/* Route loading spinner */}
      {loadingRoute && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 rounded-full px-4 py-2 text-sm font-medium shadow flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            Loading route…
          </div>
        </div>
      )}
    </div>
  )
}
