// In-memory session store (single admin, single instance)
// Uses globalThis.crypto (Web Crypto API) — compatible with Node.js and Edge Runtime
const activeSessions = new Set<string>()

export function createSession(): string {
  const token = globalThis.crypto.randomUUID()
  activeSessions.add(token)
  return token
}

export function validateSession(token: string | undefined): boolean {
  if (!token) return false
  return activeSessions.has(token)
}

export function destroySession(token: string): void {
  activeSessions.delete(token)
}
