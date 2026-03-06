import { Route, RoutePin, RouteStatus } from '@/types/route'
import seedRoutes from './routes'
import * as turfCentroid from '@turf/centroid'
import * as turfBbox from '@turf/bbox'

// In-memory store — persists for the lifetime of the dev server process
const routes: Map<string, Route & { report_count: number; report_reasons: string[] }> = new Map(
  seedRoutes.map((r) => [r.id, { ...r, report_count: 0, report_reasons: [] }])
)

function centroidOf(route: Route): [number, number] {
  try {
    const c = turfCentroid.centroid(route.geojson)
    return c.geometry.coordinates as [number, number]
  } catch {
    const coords = route.geojson.geometry.coordinates
    return coords[Math.floor(coords.length / 2)] as [number, number]
  }
}

function bboxOf(route: Route): [number, number, number, number] {
  try {
    return turfBbox.bbox(route.geojson) as [number, number, number, number]
  } catch {
    const coords = route.geojson.geometry.coordinates
    const lngs = coords.map((c) => c[0])
    const lats = coords.map((c) => c[1])
    return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
  }
}

export function getRoutesInBbox(west: number, south: number, east: number, north: number): RoutePin[] {
  const pins: RoutePin[] = []
  for (const route of routes.values()) {
    if (route.status !== 'approved') continue
    const [lng, lat] = centroidOf(route)
    if (lng >= west && lng <= east && lat >= south && lat <= north) {
      pins.push({ id: route.id, title: route.title, distance_km: route.distance_km, lng, lat })
    }
  }
  return pins
}

export function getRouteById(id: string): Route | null {
  return routes.get(id) ?? null
}

export function createRoute(data: Omit<Route, 'id' | 'created_at' | 'status'>): Route {
  const id = `route-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const route = {
    ...data,
    id,
    status: 'pending' as RouteStatus,
    created_at: new Date().toISOString(),
    report_count: 0,
    report_reasons: [] as string[],
  }
  routes.set(id, route)
  return route
}

export function approveRoute(id: string): boolean {
  const route = routes.get(id)
  if (!route) return false
  routes.set(id, { ...route, status: 'approved' })
  return true
}

export function rejectRoute(id: string): boolean {
  const route = routes.get(id)
  if (!route) return false
  routes.set(id, { ...route, status: 'rejected' })
  return true
}

export function flagRoute(id: string, reason: string): boolean {
  const route = routes.get(id)
  if (!route) return false
  const report_count = route.report_count + 1
  const report_reasons = [...route.report_reasons, reason]
  const status: RouteStatus = report_count >= 3 ? 'flagged' : route.status
  routes.set(id, { ...route, report_count, report_reasons, status })
  return true
}

export function getPendingRoutes(): Route[] {
  return [...routes.values()].filter((r) => r.status === 'pending')
}

export function getFlaggedRoutes(): Route[] {
  return [...routes.values()].filter((r) => r.status === 'flagged')
}
