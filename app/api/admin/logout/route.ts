import { NextRequest, NextResponse } from 'next/server'
import { destroySession } from '@/lib/session'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value
  if (token) destroySession(token)
  const response = NextResponse.json({ success: true })
  response.cookies.delete('admin_session')
  return response
}
