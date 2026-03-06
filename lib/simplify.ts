import simplify from '@turf/simplify'

export function simplifyRoute(
  geojson: GeoJSON.Feature<GeoJSON.LineString>,
  tolerance = 0.0001
): GeoJSON.Feature<GeoJSON.LineString> {
  return simplify(geojson, { tolerance, highQuality: true }) as GeoJSON.Feature<GeoJSON.LineString>
}
