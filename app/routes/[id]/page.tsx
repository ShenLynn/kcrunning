import { notFound } from 'next/navigation'
import { getRouteById } from '@/lib/db'
import RoutePageClient from '@/components/map/RoutePageClient'

export default async function RoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const route = await getRouteById(id)
  if (!route || route.status !== 'approved') notFound()

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-white shrink-0">
        <a href="/" className="text-gray-400 hover:text-gray-700 text-sm">← Map</a>
        <div>
          <h1 className="font-semibold text-gray-900">{route.title}</h1>
          <p className="text-xs text-gray-500">{route.distance_km} km</p>
        </div>
      </header>
      <div className="flex-1">
        <RoutePageClient route={route} />
      </div>
    </div>
  )
}
