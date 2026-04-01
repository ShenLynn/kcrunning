import { NextRequest, NextResponse } from 'next/server'
import { flagRoute } from '@/lib/db'
import { hashIp, getClientIp, hasAlreadyReported, recordReport } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { routeId, reason } = body

  if (!routeId || typeof routeId !== 'string') {
    return NextResponse.json({ error: 'Missing routeId' }, { status: 400 })
  }

  const ipHash = hashIp(getClientIp(request))
  if (hasAlreadyReported(ipHash, routeId)) {
    return NextResponse.json({ success: true }) // silent dedupe
  }

  const ok = await flagRoute(routeId, reason ?? '')
  if (!ok) return NextResponse.json({ error: 'Route not found' }, { status: 404 })

  recordReport(ipHash, routeId)

  // Notify admin on new report (best-effort)
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true' && process.env.RESEND_API_KEY && process.env.RESEND_TO_EMAIL) {
    const subject = 'Route flagged'
    const html = `<p>Route <strong>${routeId}</strong> has been reported.</p>${reason ? `<p>Reason: ${reason}</p>` : ''}`
    fetch('https://api.resend.com/emails', {
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
    }).catch(console.error)
  }

  return NextResponse.json({ success: true })
}
