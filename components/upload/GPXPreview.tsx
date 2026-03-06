'use client'

import Map, { Source, Layer } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as turfBbox from '@turf/bbox'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

interface Props {
  geojson: GeoJSON.Feature<GeoJSON.LineString>
}

export default function GPXPreview({ geojson }: Props) {
  const [minLng, minLat, maxLng, maxLat] = turfBbox.bbox(geojson)

  return (
    <div className="w-full h-48 rounded-lg overflow-hidden border border-gray-200">
      <Map
        mapStyle={MAP_STYLE}
        initialViewState={{
          bounds: [[minLng, minLat], [maxLng, maxLat]],
          fitBoundsOptions: { padding: 30 },
        }}
        interactive={false}
        style={{ width: '100%', height: '100%' }}
      >
        <Source id="preview" type="geojson" data={geojson}>
          <Layer
            id="preview-line"
            type="line"
            paint={{ 'line-color': '#ef4444', 'line-width': 3 }}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          />
        </Source>
      </Map>
    </div>
  )
}
