// Data layer abstraction.
// In demo mode: uses in-memory mock store.
// In production (Stage B): replace this file's internals with Supabase calls.
// All API routes import from here only — never directly from mock or Supabase.

export {
  getRoutesInBbox,
  getRouteById,
  createRoute,
  approveRoute,
  rejectRoute,
  flagRoute,
  getPendingRoutes,
  getFlaggedRoutes,
} from '@/lib/mock/store'
