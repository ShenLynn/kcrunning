import { gpx } from '@tmcw/togeojson'

export function parseGpx(xmlString: string): GeoJSON.Feature<GeoJSON.LineString> | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlString, 'application/xml')
    const parseError = doc.querySelector('parsererror')
    if (parseError) return null

    const root = doc.documentElement
    if (root.tagName.toLowerCase() !== 'gpx') return null

    const geojson = gpx(doc)
    const feature = geojson.features.find(
      (f) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
    )
    if (!feature) return null

    // Flatten MultiLineString to LineString
    if (feature.geometry.type === 'MultiLineString') {
      const coords = feature.geometry.coordinates.flat()
      return {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      }
    }

    return feature as GeoJSON.Feature<GeoJSON.LineString>
  } catch {
    return null
  }
}

export function stripTimestamps(geojson: GeoJSON.Feature<GeoJSON.LineString>): GeoJSON.Feature<GeoJSON.LineString> {
  // Coordinates are [lng, lat, ele?, time?] — keep only [lng, lat]
  return {
    ...geojson,
    geometry: {
      ...geojson.geometry,
      coordinates: geojson.geometry.coordinates.map(([lng, lat]) => [lng, lat]),
    },
  }
}

export function validateCoordinates(geojson: GeoJSON.Feature<GeoJSON.LineString>): boolean {
  return geojson.geometry.coordinates.every(
    ([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
  )
}
