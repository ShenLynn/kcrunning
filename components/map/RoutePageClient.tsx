'use client'

import dynamic from 'next/dynamic'
import { Route } from '@/types/route'

const RouteMapView = dynamic(() => import('./RouteMapView'), { ssr: false })

export default function RoutePageClient({ route }: { route: Route }) {
  return <RouteMapView route={route} />
}
