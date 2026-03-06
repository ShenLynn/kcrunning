import { NextRequest, NextResponse } from 'next/server'
import { getRouteById } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const route = getRouteById(id)
  if (!route) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (route.status !== 'approved') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(route)
}
