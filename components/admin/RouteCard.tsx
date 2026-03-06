'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Route } from '@/types/route'

const GPXPreview = dynamic(() => import('@/components/upload/GPXPreview'), { ssr: false })

interface Props {
  route: Route
  onAction: (id: string, action: 'approve' | 'reject') => void
}

export default function RouteCard({ route, onAction }: Props) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [expanded, setExpanded] = useState(false)

  async function act(action: 'approve' | 'reject') {
    setLoading(action)
    try {
      await fetch(`/api/admin/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: route.id }),
      })
      onAction(route.id, action)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-gray-900">{route.title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {route.distance_km} km · {new Date(route.created_at).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-700 shrink-0"
        >
          {expanded ? 'Hide map' : 'Show map'}
        </button>
      </div>

      {route.description && (
        <p className="text-sm text-gray-500">{route.description}</p>
      )}

      {route.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {route.tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {route.report_reasons && route.report_reasons.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
          <p className="text-xs font-medium text-amber-700 mb-1">Reports ({route.report_reasons.length})</p>
          {route.report_reasons.map((r, i) => (
            <p key={i} className="text-xs text-amber-600">• {r}</p>
          ))}
        </div>
      )}

      {expanded && (
        <GPXPreview geojson={route.geojson} />
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => act('approve')}
          disabled={!!loading}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
        >
          {loading === 'approve' ? '…' : 'Approve'}
        </button>
        <button
          onClick={() => act('reject')}
          disabled={!!loading}
          className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-sm font-medium py-1.5 rounded-lg transition-colors"
        >
          {loading === 'reject' ? '…' : 'Reject'}
        </button>
      </div>
    </div>
  )
}
