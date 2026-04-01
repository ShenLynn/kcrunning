'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import Script from 'next/script'
import { parseGpx, stripTimestamps } from '@/lib/gpx'

const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

const GPXPreview = dynamic(() => import('./GPXPreview'), { ssr: false })

export default function UploadForm() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [preview, setPreview] = useState<GeoJSON.Feature<GeoJSON.LineString> | null>(null)
  const [fileError, setFileError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setFileError('')
    setPreview(null)
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const geojson = parseGpx(text)
      if (!geojson) {
        setFileError("Could not read file. Make sure it's a valid .gpx file.")
        return
      }
      setPreview(stripTimestamps(geojson))
    }
    reader.readAsText(file)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitError('')
    if (!preview) { setFileError('Please select a valid GPX file.'); return }
    if (!title.trim()) return

    setSubmitting(true)
    try {
      const form = e.currentTarget
      const formData = new FormData(form)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Upload failed. Please try again.')
        return
      }
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Route submitted!</h2>
        <p className="text-gray-500 text-sm mb-6">It'll appear on the map once approved.</p>
        <div className="flex gap-3 justify-center">
          <a href="/" className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2">
            Back to map
          </a>
          <button
            onClick={() => { setSubmitted(false); setPreview(null); setTitle(''); setDescription(''); setTags(''); if (fileRef.current) fileRef.current.value = '' }}
            className="text-sm text-red-600 hover:text-red-700 underline underline-offset-2"
          >
            Upload another
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {TURNSTILE_KEY && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      )}
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot */}
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />

      {/* File */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">GPX file <span className="text-red-500">*</span></label>
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept=".gpx,application/gpx+xml"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-red-50 file:text-red-700 hover:file:bg-red-100 cursor-pointer"
          required
        />
        {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
      </div>

      {/* Preview */}
      {preview && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Preview</p>
          <GPXPreview geojson={preview} />
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
        <input
          type="text"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The Big Fish"
          maxLength={80}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 text-xs">(optional)</span></label>
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell us about this route…"
          rows={3}
          maxLength={300}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tags <span className="text-gray-400 text-xs">(optional, comma-separated)</span></label>
        <input
          type="text"
          name="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="heart, funny, midtown"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
        />
      </div>

      {/* Cloudflare Turnstile */}
      {TURNSTILE_KEY && (
        <div className="cf-turnstile" data-sitekey={TURNSTILE_KEY} data-theme="light" />
      )}

      {submitError && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{submitError}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !preview}
        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
      >
        {submitting ? 'Submitting…' : 'Submit for review'}
      </button>

      <p className="text-xs text-center text-gray-400">
        Routes are reviewed before appearing on the map.
      </p>
    </form>
    </>
  )
}
