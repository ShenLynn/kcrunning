import { NextRequest, NextResponse } from 'next/server'
import { getRoutesInBbox } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const west = parseFloat(searchParams.get('west') ?? '-180')
  const south = parseFloat(searchParams.get('south') ?? '-90')
  const east = parseFloat(searchParams.get('east') ?? '180')
  const north = parseFloat(searchParams.get('north') ?? '90')

  if ([west, south, east, north].some(isNaN)) {
    return NextResponse.json({ error: 'Invalid bbox params' }, { status: 400 })
  }

  const pins = await getRoutesInBbox(west, south, east, north)
  return NextResponse.json(pins, {
    headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
  })
}
