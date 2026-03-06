'use client'

import { useState } from 'react'
import { Route } from '@/types/route'
import RouteCard from './RouteCard'

interface Props {
  initialPending: Route[]
  initialFlagged: Route[]
}

export default function AdminDashboard({ initialPending, initialFlagged }: Props) {
  const [tab, setTab] = useState<'pending' | 'flagged'>('pending')
  const [pending, setPending] = useState<Route[]>(initialPending)
  const [flagged, setFlagged] = useState<Route[]>(initialFlagged)

  function handleAction(id: string, action: 'approve' | 'reject') {
    setPending((prev) => prev.filter((r) => r.id !== id))
    setFlagged((prev) => prev.filter((r) => r.id !== id))
  }

  const list = tab === 'pending' ? pending : flagged

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-400 hover:text-gray-700 text-sm">← Map</a>
          <h1 className="font-semibold text-gray-900">Admin</h1>
        </div>
        <a
          href="/api/admin/logout"
          className="text-xs text-gray-400 hover:text-gray-600"
          onClick={async (e) => {
            e.preventDefault()
            await fetch('/api/admin/logout', { method: 'POST' })
            window.location.href = '/admin/login'
          }}
        >
          Sign out
        </a>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
          {(['pending', 'flagged'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t} ({t === 'pending' ? pending.length : flagged.length})
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No {tab} routes
          </div>
        ) : (
          <div className="space-y-4">
            {list.map((route) => (
              <RouteCard key={route.id} route={route} onAction={handleAction} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
