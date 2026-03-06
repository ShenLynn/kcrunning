import { getPendingRoutes, getFlaggedRoutes } from '@/lib/db'
import AdminDashboard from '@/components/admin/AdminDashboard'

export default function AdminPage() {
  const pending = getPendingRoutes()
  const flagged = getFlaggedRoutes()
  return <AdminDashboard initialPending={pending} initialFlagged={flagged} />
}
