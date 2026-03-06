'use client'

import { useState } from 'react'
import { Popup } from 'react-map-gl/maplibre'
import { Route } from '@/types/route'
import * as turfCentroid from '@turf/centroid'

interface Props {
  route: Route
  onClose: () => void
  onRouteRemoved: (id: string) => void
}

export default function RoutePopup({ route, onClose, onRouteRemoved }: Props) {
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reported, setReported] = useState(false)
  const [copied, setCopied] = useState(false)

  const centroid = turfCentroid.centroid(route.geojson)
  const [lng, lat] = centroid.geometry.coordinates

  function downloadGpx() {
    const coords = route.geojson.geometry.coordinates
    const trkpts = coords
      .map(([lon, la]) => `      <trkpt lat="${la}" lon="${lon}"></trkpt>`)
      .join('\n')
    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="KCRunning">
  <trk>
    <name>${route.title}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${route.title.replace(/\s+/g, '-').toLowerCase()}.gpx`
    a.click()
    URL.revokeObjectURL(url)
  }

  function shareRoute() {
    const url = `${window.location.origin}/routes/${route.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function submitReport() {
    if (!reportReason.trim()) return
    await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeId: route.id, reason: reportReason }),
    })
    setReported(true)
    setReporting(false)
  }

  return (
    <Popup
      longitude={lng}
      latitude={lat}
      onClose={onClose}
      closeOnClick={false}
      maxWidth="280px"
      className="route-popup"
    >
      <div className="p-1 min-w-[220px]">
        <h3 className="font-semibold text-gray-900 text-base mb-1 pr-4">{route.title}</h3>
        {route.description && (
          <p className="text-gray-500 text-xs mb-2 leading-snug">{route.description}</p>
        )}
        {route.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {route.tags.map((tag) => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}
        <div className="text-sm text-gray-700 mb-3 font-medium">
          {route.distance_km} km
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={downloadGpx}
            className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-1.5 rounded transition-colors"
          >
            Download GPX
          </button>
          <button
            onClick={shareRoute}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium py-1.5 rounded transition-colors"
          >
            {copied ? 'Link copied!' : 'Share link'}
          </button>

          {!reporting && !reported && (
            <button
              onClick={() => setReporting(true)}
              className="w-full text-gray-400 hover:text-gray-600 text-xs py-1 transition-colors"
            >
              Report
            </button>
          )}

          {reporting && (
            <div className="mt-1">
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Reason for report…"
                rows={2}
                className="w-full text-xs border border-gray-200 rounded p-1.5 resize-none focus:outline-none focus:border-gray-400"
              />
              <div className="flex gap-1 mt-1">
                <button
                  onClick={submitReport}
                  className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium py-1 rounded transition-colors"
                >
                  Submit
                </button>
                <button
                  onClick={() => { setReporting(false); setReportReason('') }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium py-1 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {reported && (
            <p className="text-xs text-center text-gray-500">Thanks, we'll review this.</p>
          )}
        </div>
      </div>
    </Popup>
  )
}
