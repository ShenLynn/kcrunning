'use client'

import { useEffect } from 'react'
import { useMap, Source, Layer } from 'react-map-gl/maplibre'
import { RoutePin } from '@/types/route'

interface Props {
  pins: RoutePin[]
  onPinClick: (id: string) => void
  selectedId: string | null
}

export default function PinLayer({ pins, onPinClick, selectedId }: Props) {
  const { current: map } = useMap()

  useEffect(() => {
    if (!map) return
    const handler = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const feature = e.features?.[0]
      if (!feature) return
      const id = feature.properties?.id as string
      if (id) onPinClick(id)
    }
    map.on('click', 'pins', handler)
    map.on('mouseenter', 'pins', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'pins', () => { map.getCanvas().style.cursor = '' })
    return () => {
      map.off('click', 'pins', handler)
    }
  }, [map, onPinClick])

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: pins.map((pin) => ({
      type: 'Feature',
      properties: { id: pin.id, title: pin.title, distance_km: pin.distance_km },
      geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
    })),
  }

  return (
    <Source id="pins-source" type="geojson" data={geojson}>
      <Layer
        id="pins"
        type="circle"
        paint={{
          'circle-radius': 8,
          'circle-color': [
            'case',
            ['==', ['get', 'id'], selectedId ?? ''],
            '#ef4444',
            '#dc2626',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.9,
        }}
      />
    </Source>
  )
}
