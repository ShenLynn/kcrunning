'use client'

import { useState } from 'react'
import { MapRef } from 'react-map-gl/maplibre'

interface Props {
  mapRef: React.RefObject<MapRef | null>
}

export default function LocationControl({ mapRef }: Props) {
  const [loading, setLoading] = useState(false)

  function locate() {
    if (!navigator.geolocation) return
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 14,
          duration: 1200,
        })
        setLoading(false)
      },
      () => setLoading(false)
    )
  }

  return (
    <button
      onClick={locate}
      title="Go to my location"
      className="absolute bottom-20 right-4 bg-white hover:bg-gray-50 shadow-md rounded-full w-10 h-10 flex items-center justify-center transition-colors"
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="8" strokeDasharray="4 2" />
        </svg>
      )}
    </button>
  )
}
