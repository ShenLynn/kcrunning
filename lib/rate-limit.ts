import crypto from 'crypto'

// In-memory stores — replaced by DB queries in Stage B (Supabase)
const uploadLog = new Map<string, number[]>() // ipHash -> timestamps
const reportLog = new Map<string, Set<string>>() // ipHash -> Set<routeId>

export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex')
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return (forwarded?.split(',')[0] ?? '127.0.0.1').trim()
}

/** Returns true if the IP has exceeded the upload limit */
export function isUploadRateLimited(ipHash: string, maxPerDay = 3): boolean {
  const now = Date.now()
  const windowMs = 24 * 60 * 60 * 1000
  const timestamps = (uploadLog.get(ipHash) ?? []).filter((t) => now - t < windowMs)
  uploadLog.set(ipHash, timestamps)
  return timestamps.length >= maxPerDay
}

export function recordUpload(ipHash: string): void {
  const timestamps = uploadLog.get(ipHash) ?? []
  uploadLog.set(ipHash, [...timestamps, Date.now()])
}

/** Returns true if the IP has already reported this route */
export function hasAlreadyReported(ipHash: string, routeId: string): boolean {
  return reportLog.get(ipHash)?.has(routeId) ?? false
}

export function recordReport(ipHash: string, routeId: string): void {
  const routes = reportLog.get(ipHash) ?? new Set<string>()
  routes.add(routeId)
  reportLog.set(ipHash, routes)
}
