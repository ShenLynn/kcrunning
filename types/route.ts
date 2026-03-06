export type RouteStatus = 'pending' | 'approved' | 'rejected' | 'flagged'

export interface Route {
  id: string
  title: string
  description: string | null
  tags: string[]
  geojson: GeoJSON.Feature<GeoJSON.LineString>
  distance_km: number
  status: RouteStatus
  created_at: string
  report_count?: number
  report_reasons?: string[]
}

export interface RoutePin {
  id: string
  title: string
  distance_km: number
  lng: number
  lat: number
}
