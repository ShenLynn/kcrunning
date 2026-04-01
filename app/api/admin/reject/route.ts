import { NextRequest, NextResponse } from 'next/server'
import { rejectRoute } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await request.json()
  const ok = await rejectRoute(id)
  if (!ok) return NextResponse.json({ error: 'Route not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
