import { NextRequest, NextResponse } from 'next/server'

export interface GeocodingResult {
  place_name: string
  lng: number
  lat: number
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  if (!q?.trim()) {
    return NextResponse.json([], { status: 200 })
  }

  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY
  if (!key) {
    return NextResponse.json({ error: 'Geocoding not configured' }, { status: 503 })
  }

  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${key}&limit=5`
  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) {
    return NextResponse.json([], { status: 200 })
  }

  const json = await res.json() as { features?: Array<{ place_name: string; center: [number, number] }> }
  const results: GeocodingResult[] = (json.features ?? []).map((f) => ({
    place_name: f.place_name,
    lng: f.center[0],
    lat: f.center[1],
  }))

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'public, s-maxage=300' },
  })
}
