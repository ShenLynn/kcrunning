import { NextRequest, NextResponse } from 'next/server'
import { createRoute } from '@/lib/db'
import { stripTimestamps, validateCoordinates } from '@/lib/gpx'
import { simplifyRoute } from '@/lib/simplify'
import { routeDistanceKm } from '@/lib/distance'
import * as turfCentroid from '@turf/centroid'
import * as turfBbox from '@turf/bbox'
import { gpx } from '@tmcw/togeojson'

export async function POST(request: NextRequest) {
  const formData = await request.formData()

  // Honeypot check
  if (formData.get('website')) {
    return NextResponse.json({ success: true }) // silent reject
  }

  const title = (formData.get('title') as string)?.trim()
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'GPX file is required' }, { status: 400 })

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
  }

  const xmlString = await file.text()

  // Parse GPX server-side
  let geojson: GeoJSON.Feature<GeoJSON.LineString> | null = null
  try {
    const { DOMParser } = await import('@xmldom/xmldom')
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlString, 'application/xml')
    const root = doc.documentElement
    if (!root || root.tagName.toLowerCase() !== 'gpx') throw new Error('Not a GPX file')
    const fc = gpx(doc as unknown as Document)
    const feature = fc.features.find(
      (f) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
    )
    if (!feature) throw new Error('No track found in GPX')
    if (feature.geometry.type === 'MultiLineString') {
      geojson = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: feature.geometry.coordinates.flat() },
      }
    } else {
      geojson = feature as GeoJSON.Feature<GeoJSON.LineString>
    }
  } catch (err) {
    return NextResponse.json({ error: 'Invalid GPX file' }, { status: 400 })
  }

  if (!validateCoordinates(geojson)) {
    return NextResponse.json({ error: 'GPX contains invalid coordinates' }, { status: 400 })
  }

  geojson = stripTimestamps(geojson)
  geojson = simplifyRoute(geojson)

  const distance_km = routeDistanceKm(geojson)
  if (distance_km < 0.1) {
    return NextResponse.json({ error: 'Route is too short (min 100m)' }, { status: 400 })
  }

  const description = (formData.get('description') as string)?.trim() || null
  const tagsRaw = (formData.get('tags') as string)?.trim() || ''
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const route = createRoute({ title, description, tags, geojson, distance_km })
  return NextResponse.json({ success: true, id: route.id })
}
