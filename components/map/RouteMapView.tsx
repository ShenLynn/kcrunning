'use client'

import Map from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Source, Layer } from 'react-map-gl/maplibre'
import { Route } from '@/types/route'
import * as turfBbox from '@turf/bbox'

const MAP_STYLE = process.env.NEXT_PUBLIC_MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`
  : 'https://tiles.openfreemap.org/styles/liberty'

interface Props {
  route: Route
}

export default function RouteMapView({ route }: Props) {
  const [minLng, minLat, maxLng, maxLat] = turfBbox.bbox(route.geojson)
  const padding = 60

  return (
    <Map
      mapStyle={MAP_STYLE}
      initialViewState={{
        bounds: [[minLng, minLat], [maxLng, maxLat]],
        fitBoundsOptions: { padding },
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <Source id="route" type="geojson" data={route.geojson}>
        <Layer
          id="route-line"
          type="line"
          paint={{ 'line-color': '#ef4444', 'line-width': 3 }}
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        />
      </Source>
    </Map>
  )
}
