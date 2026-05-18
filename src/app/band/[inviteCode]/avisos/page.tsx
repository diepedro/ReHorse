'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { BandMember } from '@/lib/types'

interface Announcement {
  id: number
  content: string
  authorId: string | null
  createdAt: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AvisosPage() {
  const params = useParams()
  const inviteCode = params.inviteCode as string
  const { data: session } = useSession()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [members, setMembers] = useState<BandMember[]>([])
  const [bandCreatedBy, setBandCreatedBy] = useState<string | null>(null)
  const [currentMember, setCurrentMember] = useState<BandMember | null>(null)
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    const [aRes, bRes] = await Promise.all([
      fetch(`/api/bands/${inviteCode}/announcements`),
      fetch(`/api/bands/${inviteCode}`),
    ])
    if (aRes.ok) setAnnouncements(await aRes.json())
    if (bRes.ok) {
      const band = await bRes.json()
      setMembers(band.members)
      setBandCreatedBy(band.createdBy)
      const memberId = localStorage.getItem(`band_${inviteCode}`)
      if (memberId) setCurrentMember(band.members.find((m: BandMember) => m.id === memberId) ?? null)
    }
  }, [inviteCode])

  useEffect(() => { load() }, [load])

  async function post(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setPosting(true)
    await fetch(`/api/bands/${inviteCode}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, memberId: currentMember?.id }),
    })
    setContent('')
    setPosting(false)
    load()
  }

  async function del(id: number) {
    await fetch(`/api/bands/${inviteCode}/announcements`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const isAdmin = session?.user?.id && bandCreatedBy === session.user.id

  function authorName(authorId: string | null) {
    if (!authorId) return 'Anônimo'
    const m = members.find((m) => m.id === authorId)
    return m?.displayName ?? 'Membro'
  }

  function authorColor(authorId: string | null) {
    const m = members.find((m) => m.id === authorId)
    return m?.color ?? '#6B7280'
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Post form */}
      {(currentMember || isAdmin) && (
        <form onSubmit={post} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escreva um aviso para a banda..."
            maxLength={1000}
            rows={3}
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">{content.length}/1000</span>
            <button
              type="submit"
              disabled={!content.trim() || posting}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {posting ? 'Postando...' : 'Publicar aviso'}
            </button>
          </div>
        </form>
      )}

      {/* Announcements list */}
      {announcements.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📢</p>
          <p className="text-sm">Nenhum aviso ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: authorColor(a.authorId) }} />
                  <span className="text-xs font-semibold text-gray-700">{authorName(a.authorId)}</span>
                  <span className="text-xs text-gray-400">{fmtDate(a.createdAt)}</span>
                </div>
                {isAdmin && (
                  <button onClick={() => del(a.id)} className="text-gray-300 hover:text-red-400 text-xs shrink-0">×</button>
                )}
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{a.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
