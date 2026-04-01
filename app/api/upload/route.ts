import { NextRequest, NextResponse } from 'next/server'
import { createRoute, uploadGpxFile } from '@/lib/db'
import { stripTimestamps, validateCoordinates } from '@/lib/gpx'
import { simplifyRoute } from '@/lib/simplify'
import { routeDistanceKm } from '@/lib/distance'
import { hashIp, getClientIp, isUploadRateLimited, recordUpload } from '@/lib/rate-limit'
import { gpx } from '@tmcw/togeojson'

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  // File size guard before parsing body
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 })
  }

  const formData = await request.formData()

  // Honeypot
  if (formData.get('website')) {
    return NextResponse.json({ success: true }) // silent reject
  }

  // IP rate limit
  const ip = getClientIp(request)
  const ipHash = hashIp(ip)
  if (isUploadRateLimited(ipHash)) {
    return NextResponse.json({ error: 'Too many uploads. Try again tomorrow.' }, { status: 429 })
  }

  const title = (formData.get('title') as string)?.trim()
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (title.length > 80) return NextResponse.json({ error: 'Title too long (max 80 characters)' }, { status: 400 })

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'GPX file is required' }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 })
  }

  const xmlString = await file.text()

  // Validate it's XML before attempting parse
  if (!xmlString.trimStart().startsWith('<')) {
    return NextResponse.json({ error: 'Invalid GPX file' }, { status: 400 })
  }

  // Parse and validate GPX server-side
  let geojson: GeoJSON.Feature<GeoJSON.LineString> | null = null
  try {
    const { DOMParser } = await import('@xmldom/xmldom')
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlString, 'application/xml')

    // Check for XML parse errors
    const parseError = doc.getElementsByTagName('parsererror')
    if (parseError.length > 0) throw new Error('XML parse error')

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
  } catch {
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

  // Turnstile bot check (skip in demo mode or if key not configured)
  if (!DEMO && process.env.TURNSTILE_SECRET_KEY) {
    const token = formData.get('cf-turnstile-response') as string | null
    if (!token) {
      return NextResponse.json({ error: 'Bot check required' }, { status: 403 })
    }
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token }),
    })
    const { success } = await verifyRes.json() as { success: boolean }
    if (!success) {
      return NextResponse.json({ error: 'Bot check failed. Please try again.' }, { status: 403 })
    }
  }

  const description = (formData.get('description') as string)?.trim() || null
  const tagsRaw = (formData.get('tags') as string)?.trim() || ''
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const route = await createRoute({ title, description, tags, geojson, distance_km, ip_hash: ipHash })
  recordUpload(ipHash)

  // Store original GPX in Supabase Storage (best-effort, non-blocking)
  if (!DEMO) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const safeFilename = file.name?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'route.gpx'
    uploadGpxFile(route.id, buffer, safeFilename).catch(console.error)
  }

  // Notify admin via email (best-effort)
  if (!DEMO && process.env.RESEND_API_KEY && process.env.RESEND_TO_EMAIL) {
    notifyAdmin('New route submitted', `<p><strong>${title}</strong> (${distance_km} km) has been submitted and is awaiting review.</p>`).catch(console.error)
  }

  return NextResponse.json({ success: true, id: route.id })
}

async function notifyAdmin(subject: string, html: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'KCRunning <onboarding@resend.dev>',
      to: process.env.RESEND_TO_EMAIL,
      subject,
      html,
    }),
  })
}
