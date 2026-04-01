// Stateless session tokens using HMAC-SHA256.
// Works across serverless function instances (no shared in-memory state).
// The token is HMAC(secret, "admin-session") — valid as long as ADMIN_PASSWORD doesn't change.

async function computeToken(): Promise<string> {
  const secret = process.env.ADMIN_PASSWORD ?? ''
  const enc = new TextEncoder()
  const key = await globalThis.crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode('admin-session'))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function createSession(): Promise<string> {
  return computeToken()
}

export async function validateSession(token: string | undefined): Promise<boolean> {
  if (!token) return false
  const expected = await computeToken()
  return token === expected
}

export function destroySession(_token: string): void {
  // Stateless — nothing to clean up server-side. Caller clears the cookie.
}
