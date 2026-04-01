import { getPendingRoutes, getFlaggedRoutes } from '@/lib/db'
import AdminDashboard from '@/components/admin/AdminDashboard'

export default async function AdminPage() {
  const [pending, flagged] = await Promise.all([getPendingRoutes(), getFlaggedRoutes()])
  return <AdminDashboard initialPending={pending} initialFlagged={flagged} />
}
