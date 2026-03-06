import UploadForm from '@/components/upload/UploadForm'

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <a href="/" className="text-gray-400 hover:text-gray-700 text-sm">← Map</a>
        <h1 className="font-semibold text-gray-900">Upload a route</h1>
      </header>
      <main className="max-w-lg mx-auto px-4 py-8">
        <p className="text-sm text-gray-500 mb-6">
          Got a funny GPS drawing? Upload your <strong>.gpx</strong> file and it'll appear on the map once approved.
        </p>
        <UploadForm />
      </main>
    </div>
  )
}
