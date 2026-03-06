'use client'

import { Source, Layer } from 'react-map-gl/maplibre'
import { Route } from '@/types/route'

interface Props {
  route: Route
}

export default function RouteLayer({ route }: Props) {
  return (
    <Source id="selected-route" type="geojson" data={route.geojson}>
      <Layer
        id="selected-route-line"
        type="line"
        paint={{
          'line-color': '#ef4444',
          'line-width': 3,
          'line-opacity': 0.9,
        }}
        layout={{
          'line-join': 'round',
          'line-cap': 'round',
        }}
      />
    </Source>
  )
}
