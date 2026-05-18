'use client'

import { useEffect, useState } from 'react'

interface AddSongModalProps {
  open: boolean
  onClose: () => void
  onAdd: (name: string) => void
}

export default function AddSongModal({ open, onClose, onAdd }: AddSongModalProps) {
  const [name, setName] = useState('')

  // Reset when opened
  useEffect(() => {
    if (open) setName('')
  }, [open])

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim()) {
      onAdd(name.trim())
      onClose()
    }
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm dark:bg-gray-900">
        <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Adicionar música</h3>
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da música"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
