import { NextRequest, NextResponse } from 'next/server'
import { flagRoute } from '@/lib/db'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { routeId, reason } = body

  if (!routeId || typeof routeId !== 'string') {
    return NextResponse.json({ error: 'Missing routeId' }, { status: 400 })
  }

  const ok = flagRoute(routeId, reason ?? '')
  if (!ok) return NextResponse.json({ error: 'Route not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
