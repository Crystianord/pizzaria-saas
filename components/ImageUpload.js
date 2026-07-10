'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function resizeAndUpload(file, storeId) {
  const img = new Image()
  const objectUrl = URL.createObjectURL(file)
  await new Promise((resolve, reject) => {
    img.onload  = resolve
    img.onerror = reject
    img.src = objectUrl
  })
  URL.revokeObjectURL(objectUrl)

  const ratio  = Math.min(800 / img.width, 800 / img.height, 1)
  const canvas = document.createElement('canvas')
  canvas.width  = Math.round(img.width  * ratio)
  canvas.height = Math.round(img.height * ratio)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise(resolve =>
    canvas.toBlob(resolve, 'image/webp', 0.85)
  )

  const path = `${storeId}/${Date.now()}.webp`

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, blob, { contentType: 'image/webp' })

  if (error) throw error

  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

export default function ImageUpload({ onUploadComplete, storeId, currentUrl }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState(null)
  const [preview, setPreview]     = useState(currentUrl || null)

  async function handleFile(file) {
    setError(null)

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato não suportado. Use JPG, PNG ou WebP. Fotos do iPhone no formato HEIC precisam ser convertidas.')
      return
    }

    setUploading(true)
    try {
      const url = await resizeAndUpload(file, storeId)
      setPreview(url)
      onUploadComplete(url)
    } catch (err) {
      console.error('Upload error:', err)
      setError(`Falha no upload: ${err?.message || JSON.stringify(err)}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      {preview && (
        <div className="relative w-32 h-32">
          <img
            src={preview}
            alt="Foto do produto"
            className="w-32 h-32 object-cover rounded-lg border border-gray-200"
          />
          <button
            type="button"
            onClick={() => { setPreview(null); onUploadComplete(null) }}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
          >
            ×
          </button>
        </div>
      )}

      {!preview && (
        <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
          <span className="text-2xl mb-1">📷</span>
          <span className="text-xs text-gray-500 text-center px-1">
            {uploading ? 'Enviando...' : 'Adicionar foto'}
          </span>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            className="hidden"
            disabled={uploading}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2 max-w-xs">
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 flex-shrink-0"
          >
            ×
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Opcional. JPG, PNG ou WebP. Máx 800×800px.
      </p>
    </div>
  )
}
