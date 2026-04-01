import { cookies } from 'next/headers'
import { validateSession } from '@/lib/session'

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_session')?.value
  return await validateSession(token)
}
