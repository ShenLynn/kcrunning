import length from '@turf/length'

export function routeDistanceKm(geojson: GeoJSON.Feature<GeoJSON.LineString>): number {
  return Math.round(length(geojson, { units: 'kilometers' }) * 10) / 10
}
