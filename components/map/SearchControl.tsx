'use client'

import { useState, useRef } from 'react'
import { MapRef } from 'react-map-gl/maplibre'
import type { GeocodingResult } from '@/app/api/geocode/route'

interface Props {
  mapRef: React.RefObject<MapRef | null>
}

export default function SearchControl({ mapRef }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodingResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(value)}`)
        const data: GeocodingResult[] = await res.json()
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  function selectResult(result: GeocodingResult) {
    mapRef.current?.flyTo({
      center: [result.lng, result.lat],
      zoom: 14,
      duration: 1200,
    })
    setQuery(result.place_name.split(',')[0])
    setResults([])
  }

  return (
    <div className="absolute top-4 left-4 z-10 w-72">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search address…"
          className="w-full bg-white shadow-md rounded-full px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      {results.length > 0 && (
        <ul className="mt-1 bg-white shadow-lg rounded-xl overflow-hidden text-sm">
          {results.map((r, i) => (
            <li key={i}>
              <button
                onClick={() => selectResult(r)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-800 truncate"
              >
                {r.place_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
