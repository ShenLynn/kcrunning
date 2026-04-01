// Data layer abstraction.
// DEMO_MODE=true  → in-memory mock store (no credentials needed)
// DEMO_MODE=false → Supabase + PostGIS

import { Route, RoutePin, RouteStatus } from '@/types/route'

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// ─── Mock imports (tree-shaken in production) ────────────────────────────────
import * as mock from '@/lib/mock/store'

// ─── Supabase helpers ────────────────────────────────────────────────────────
async function getSupabaseServer() {
  const { supabaseServer } = await import('@/lib/supabase-server')
  return supabaseServer
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getRoutesInBbox(
  west: number, south: number, east: number, north: number
): Promise<RoutePin[]> {
  if (DEMO) return mock.getRoutesInBbox(west, south, east, north)

  const db = await getSupabaseServer()
  const { data, error } = await db.rpc('routes_in_bbox', { west, south, east, north })
  if (error) { console.error(error); return [] }
  return (data ?? []) as RoutePin[]
}

export async function getRouteById(id: string): Promise<Route | null> {
  if (DEMO) return mock.getRouteById(id)

  const db = await getSupabaseServer()
  const { data, error } = await db
    .from('routes')
    .select('*')
    .eq('id', id)
    .eq('status', 'approved')
    .single()
  if (error || !data) return null
  return data as Route
}

export async function getRouteByIdAdmin(id: string): Promise<Route | null> {
  if (DEMO) return mock.getRouteById(id)

  const db = await getSupabaseServer()
  const { data, error } = await db.from('routes').select('*').eq('id', id).single()
  if (error || !data) return null
  return data as Route
}

export async function createRoute(
  data: Omit<Route, 'id' | 'created_at' | 'status'> & { gpx_file_path?: string; ip_hash?: string; geometry?: unknown; centroid?: unknown }
): Promise<Route> {
  if (DEMO) return mock.createRoute(data)

  const db = await getSupabaseServer()
  const { data: row, error } = await db
    .from('routes')
    .insert({ ...data, status: 'pending' })
    .select()
    .single()
  if (error || !row) throw new Error(error?.message ?? 'Failed to create route')
  return row as Route
}

export async function approveRoute(id: string): Promise<boolean> {
  if (DEMO) return mock.approveRoute(id)

  const db = await getSupabaseServer()
  const { error } = await db.from('routes').update({ status: 'approved' }).eq('id', id)
  return !error
}

export async function rejectRoute(id: string): Promise<boolean> {
  if (DEMO) return mock.rejectRoute(id)

  const db = await getSupabaseServer()
  const { error } = await db.from('routes').update({ status: 'rejected' }).eq('id', id)
  return !error
}

export async function flagRoute(id: string, reason: string): Promise<boolean> {
  if (DEMO) return mock.flagRoute(id, reason)

  const db = await getSupabaseServer()
  // Increment report count and append reason; flag if count reaches 3
  const { data: existing } = await db.from('routes').select('report_count, report_reasons, status').eq('id', id).single()
  if (!existing) return false
  const report_count = (existing.report_count ?? 0) + 1
  const report_reasons = [...(existing.report_reasons ?? []), reason]
  const status: RouteStatus = report_count >= 3 ? 'flagged' : existing.status
  const { error } = await db.from('routes').update({ report_count, report_reasons, status }).eq('id', id)
  return !error
}

export async function getPendingRoutes(): Promise<Route[]> {
  if (DEMO) return mock.getPendingRoutes()

  const db = await getSupabaseServer()
  const { data, error } = await db.from('routes').select('*').eq('status', 'pending').order('created_at', { ascending: true })
  if (error) { console.error(error); return [] }
  return (data ?? []) as Route[]
}

export async function getFlaggedRoutes(): Promise<Route[]> {
  if (DEMO) return mock.getFlaggedRoutes()

  const db = await getSupabaseServer()
  const { data, error } = await db.from('routes').select('*').eq('status', 'flagged').order('created_at', { ascending: true })
  if (error) { console.error(error); return [] }
  return (data ?? []) as Route[]
}

export async function uploadGpxFile(routeId: string, buffer: Buffer, filename: string): Promise<string | null> {
  if (DEMO) return null // no storage in demo

  const db = await getSupabaseServer()
  const path = `${routeId}/${filename}`
  const { error } = await db.storage.from('gpx-files').upload(path, buffer, {
    contentType: 'application/gpx+xml',
    upsert: false,
  })
  if (error) { console.error(error); return null }
  return path
}

export async function getGpxDownloadUrl(path: string): Promise<string | null> {
  if (DEMO || !path) return null

  const db = await getSupabaseServer()
  const { data, error } = await db.storage.from('gpx-files').createSignedUrl(path, 60)
  if (error || !data) return null
  return data.signedUrl
}
