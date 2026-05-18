'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string
  name: string
  email: string | null
  createdAt: string
  bandsCreated: number
  slotsJoined: number
}

interface BandMemberInline {
  id: string
  displayName: string
  color: string
  claimedBy: string | null
  claimedAt: string | null
}

interface AdminBand {
  id: string
  name: string
  inviteCode: string
  createdBy: string
  creatorName: string
  createdAt: string
  memberCount: number
  claimedCount: number
  songCount: number
  songs: {
    id: number
    name: string
    bpm: number | null
    tonality: string | null
    createdAt: string
  }[]
  members: BandMemberInline[]
}

interface AdminMember {
  id: string
  bandId: string
  bandName: string
  bandInviteCode: string
  displayName: string
  color: string
  sortOrder: number
  claimedBy: string | null
  claimedAt: string | null
}

interface AdminSong {
  id: number
  bandId: string
  bandName: string
  bandInviteCode: string
  name: string
  bpm: number | null
  tonality: string | null
  createdAt: string
}

interface AdminData {
  users: AdminUser[]
  bands: AdminBand[]
  members: AdminMember[]
  songs: AdminSong[]
}

type Tab = 'overview' | 'bands' | 'songs' | 'users' | 'members'

// id + field uniquely identify what is being edited; value is the live draft
interface EditState { id: string; field: string; value: string }

// ─── Root page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [secret, setSecret]     = useState('')
  const [authed, setAuthed]     = useState(false)
  const [data, setData]         = useState<AdminData | null>(null)
  const [tab, setTab]           = useState<Tab>('bands')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_secret')
    if (stored) { setSecret(stored); setAuthed(true) }
  }, [])

  const fetchData = useCallback(async (s: string) => {
    setLoading(true); setError('')
    const res = await fetch('/api/admin', { headers: { Authorization: `Bearer ${s}` } })
    if (!res.ok) {
      setError('Senha incorreta ou servidor indisponível.')
      setAuthed(false); sessionStorage.removeItem('admin_secret'); setLoading(false); return
    }
    setData(await res.json()); setLoading(false)
  }, [])

  useEffect(() => { if (authed && secret) fetchData(secret) }, [authed, secret, fetchData])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const s = secret.trim(); if (!s) return
    sessionStorage.setItem('admin_secret', s); setAuthed(true)
  }

  async function doDelete(type: string, id: string, label: string) {
    if (!confirm(`Deletar ${label}? Isso é irreversível.`)) return
    const res = await fetch(`/api/admin?type=${type}&id=${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${secret}` },
    })
    if (res.ok) { notify(`${label} deletado.`); fetchData(secret) }
    else notify('Erro ao deletar.', true)
  }

  async function doPatch(body: Record<string, unknown>) {
    const res = await fetch('/api/admin', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { notify('Salvo.'); fetchData(secret) }
    else { const d = await res.json(); notify(d.error ?? 'Erro ao salvar.', true) }
  }

  async function resetClaim(memberId: string, memberName: string) {
    if (!confirm(`Resetar claim de "${memberName}"?`)) return
    await doPatch({ action: 'resetClaim', memberId })
  }

  function notify(msg: string, isError = false) {
    setActionMsg(isError ? `❌ ${msg}` : `✓ ${msg}`)
    setTimeout(() => setActionMsg(''), 3000)
  }

  // ── Login gate ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-xs space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">Admin</h1>
            <p className="text-gray-500 text-xs mt-1">ReHorse dev dashboard</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <input ref={inputRef} autoFocus type="password" value={secret}
              onChange={(e) => setSecret(e.target.value)} placeholder="Admin secret"
              className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm font-mono"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button type="submit" className="w-full py-2.5 bg-white text-gray-900 font-semibold text-sm rounded-xl hover:bg-gray-100 transition-colors">
              Entrar
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Visão geral' },
    { id: 'bands',    label: 'Bandas',   count: data?.bands.length },
    { id: 'songs',    label: 'MÃºsicas',  count: data?.songs.length },
    { id: 'users',    label: 'Usuários', count: data?.users.length },
    { id: 'members',  label: 'Membros',  count: data?.members.length },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-widest text-gray-400 uppercase">Admin</span>
          <span className="text-gray-700">·</span>
          <span className="text-sm text-gray-500">ReHorse</span>
        </div>
        <div className="flex items-center gap-3">
          {actionMsg && (
            <span className={`text-xs ${actionMsg.startsWith('❌') ? 'text-red-400' : 'text-emerald-400'}`}>{actionMsg}</span>
          )}
          <button onClick={() => fetchData(secret)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">↺ Refresh</button>
          <button onClick={() => { sessionStorage.removeItem('admin_secret'); setAuthed(false); setSecret(''); setData(null) }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Sair</button>
        </div>
      </header>

      <div className="border-b border-gray-800 px-6 flex gap-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${tab === t.id ? 'text-white border-b-2 border-white -mb-px' : 'text-gray-500 hover:text-gray-300'}`}>
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 text-xs text-gray-600">{t.count}</span>}
          </button>
        ))}
      </div>

      <main className="p-6 overflow-x-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-4 h-4 border border-gray-700 border-t-gray-400 rounded-full animate-spin" />
            Carregando...
          </div>
        ) : !data ? null : tab === 'overview' ? (
          <OverviewTab data={data} />
        ) : tab === 'bands' ? (
          <BandsTable bands={data.bands} onDelete={doDelete} onPatch={doPatch} onResetClaim={resetClaim} />
        ) : tab === 'songs' ? (
          <SongsTable songs={data.songs} />
        ) : tab === 'users' ? (
          <UsersTable users={data.users} onDelete={doDelete} onPatch={doPatch} />
        ) : (
          <MembersTable members={data.members} onDelete={doDelete} onResetClaim={resetClaim} onPatch={doPatch} />
        )}
      </main>
    </div>
  )
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: AdminData }) {
  const totalClaimed = data.members.filter((m) => m.claimedBy !== null).length
  const claimedPct   = data.members.length ? Math.round((totalClaimed / data.members.length) * 100) : 0
  const totalSongs   = data.bands.reduce((acc, b) => acc + b.songCount, 0)
  const fullBands    = data.bands.filter((b) => b.claimedCount > 0 && b.claimedCount === b.memberCount).length

  const stats = [
    { label: 'Bandas',          value: data.bands.length },
    { label: 'Usuários',        value: data.users.length },
    { label: 'Slots totais',    value: data.members.length },
    { label: 'Slots ocupados',  value: `${totalClaimed} (${claimedPct}%)` },
    { label: 'Bandas completas',value: fullBands },
    { label: 'Músicas totais',  value: totalSongs },
  ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Bandas (mais recentes)</h2>
        <div className="space-y-2">
          {[...data.bands].reverse().slice(0, 10).map((b) => (
            <div key={b.id} className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-2.5 border border-gray-800">
              <div>
                <span className="font-medium text-sm">{b.name}</span>
                <span className="ml-2 text-xs text-gray-500">por {b.creatorName}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className={b.claimedCount === b.memberCount && b.memberCount > 0 ? 'text-emerald-400' : ''}>
                  {b.claimedCount}/{b.memberCount} membros
                </span>
                <span>{b.songCount} músicas</span>
                <code className="font-mono text-gray-600">{b.inviteCode}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Inline edit input ────────────────────────────────────────────────────────

function InlineInput({
  value, onChange, onSave, onCancel, mono = false, width = 'w-40',
}: {
  value: string; onChange: (v: string) => void
  onSave: () => void; onCancel: () => void
  mono?: boolean; width?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
      onBlur={onSave}
      className={`px-2 py-0.5 rounded bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-1 focus:ring-white/40 ${mono ? 'font-mono text-xs' : 'text-sm'} ${width}`}
    />
  )
}

// ─── Editable text ────────────────────────────────────────────────────────────

function Editable({
  id, field, value, display, editing, setEditing, onSave, mono = false, width,
}: {
  id: string; field: string; value: string; display?: React.ReactNode
  editing: EditState | null; setEditing: (e: EditState | null) => void
  onSave: (state: EditState) => void
  mono?: boolean; width?: string
}) {
  const isActive = editing?.id === id && editing?.field === field

  if (isActive) {
    return (
      <InlineInput
        value={editing!.value}
        onChange={(v) => setEditing({ ...editing!, value: v })}
        onSave={() => { onSave(editing!); setEditing(null) }}
        onCancel={() => setEditing(null)}
        mono={mono}
        width={width}
      />
    )
  }

  return (
    <button
      onClick={() => setEditing({ id, field, value })}
      className="text-left hover:text-white group transition-colors"
      title="Clique para editar"
    >
      {display ?? <span className={mono ? 'font-mono text-xs text-gray-400' : ''}>{value}</span>}
      <span className="ml-1 text-gray-700 group-hover:text-gray-500 text-[10px]">✎</span>
    </button>
  )
}

// ─── Bands table ──────────────────────────────────────────────────────────────

function BandsTable({
  bands, onDelete, onPatch, onResetClaim,
}: {
  bands: AdminBand[]
  onDelete: (type: string, id: string, label: string) => void
  onPatch: (body: Record<string, unknown>) => void
  onResetClaim: (memberId: string, memberName: string) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editing, setEditing]   = useState<EditState | null>(null)

  function save(state: EditState) {
    const v = state.value.trim(); if (!v) return
    const map: Record<string, Record<string, unknown>> = {
      bandName:   { action: 'setBandName',   bandId: state.id,    value: v },
      inviteCode: { action: 'setInviteCode', bandId: state.id,    value: v },
      memberName: { action: 'setMemberName', memberId: state.id,  value: v },
    }
    if (map[state.field]) onPatch(map[state.field])
  }

  function toggle(id: string) {
    setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-800">
          <Th />
          <Th>Nome</Th>
          <Th>Invite code</Th>
          <Th>Criador</Th>
          <Th>Membros</Th>
          <Th>Músicas</Th>
          <Th>Criado em</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {bands.map((b) => (
          <Fragment key={b.id}>
            <tr className="border-b border-gray-900 hover:bg-gray-900/50 transition-colors">
              <Td>
                <button onClick={() => toggle(b.id)} className="text-gray-600 hover:text-gray-300 text-xs w-4">
                  {expanded.has(b.id) ? '▾' : '▸'}
                </button>
              </Td>
              <Td className="font-medium">
                <Editable id={b.id} field="bandName" value={b.name} editing={editing} setEditing={setEditing} onSave={save} />
              </Td>
              <Td>
                <div className="flex items-center gap-2 flex-wrap">
                  <Editable id={b.id} field="inviteCode" value={b.inviteCode} editing={editing} setEditing={setEditing} onSave={save} mono width="w-36" />
                  <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join/${b.inviteCode}`)} className="text-[10px] text-gray-600 hover:text-gray-300">copy link</button>
                  <a href={`/band/${b.inviteCode}/rehearsals`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-600 hover:text-blue-400">abrir ↗</a>
                </div>
              </Td>
              <Td className="text-gray-400">{b.creatorName}</Td>
              <Td>
                <span className={b.claimedCount === b.memberCount && b.memberCount > 0 ? 'text-emerald-400' : 'text-gray-400'}>
                  {b.claimedCount}/{b.memberCount}
                </span>
              </Td>
              <Td className="text-gray-400">{b.songCount}</Td>
              <Td className="text-gray-500 text-xs">{fmtDate(b.createdAt)}</Td>
              <Td>
                <button onClick={() => onDelete('band', b.id, `banda "${b.name}"`)} className="text-xs text-gray-600 hover:text-red-400">deletar</button>
              </Td>
            </tr>

            {expanded.has(b.id) && (
              <tr className="border-b border-gray-900/40 bg-gray-900/20">
                <Td />
                <Td colSpan={7} className="py-3">
                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Músicas da banda</p>
                    {b.songs.length === 0 ? (
                      <p className="text-xs text-gray-600">Sem músicas cadastradas.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {b.songs.map((song) => (
                          <div key={song.id} className="flex items-center justify-between gap-3 text-xs border-b border-gray-900 pb-1 last:border-b-0 last:pb-0">
                            <span className="text-gray-200">{song.name}</span>
                            <div className="flex items-center gap-3 text-gray-500">
                              <span>{song.bpm ? `${song.bpm} BPM` : 'BPM —'}</span>
                              <span>{song.tonality ?? 'Tom —'}</span>
                              <span>{fmtDate(song.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Td>
              </tr>
            )}

            {expanded.has(b.id) && b.members.map((m) => (
              <tr key={m.id} className="border-b border-gray-900/40 bg-gray-900/20">
                <Td />
                <Td className="pl-6">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    <Editable id={m.id} field="memberName" value={m.displayName} editing={editing} setEditing={setEditing} onSave={save} />
                  </div>
                </Td>
                <Td colSpan={3}>
                  {m.claimedBy
                    ? <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400">claimed</span>
                    : <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">free</span>}
                  {m.claimedAt && <span className="text-xs text-gray-600 ml-2">{fmtDate(m.claimedAt)}</span>}
                </Td>
                <Td colSpan={2}>
                  <code className="text-[10px] text-gray-700 font-mono">{m.claimedBy ?? '—'}</code>
                </Td>
                <Td>
                  <div className="flex gap-3">
                    {m.claimedBy && (
                      <button onClick={() => onResetClaim(m.id, m.displayName)} className="text-xs text-gray-600 hover:text-amber-400">reset</button>
                    )}
                    <button onClick={() => onDelete('member', m.id, `membro "${m.displayName}"`)} className="text-xs text-gray-600 hover:text-red-400">deletar</button>
                  </div>
                </Td>
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}

// ─── Users table ──────────────────────────────────────────────────────────────

function UsersTable({
  users, onDelete, onPatch,
}: {
  users: AdminUser[]
  onDelete: (type: string, id: string, label: string) => void
  onPatch: (body: Record<string, unknown>) => void
}) {
  const [editing, setEditing] = useState<EditState | null>(null)
  const [absorbing, setAbsorbing] = useState<string | null>(null) // id being absorbed INTO

  function save(state: EditState) {
    const v = state.value.trim(); if (!v) return
    onPatch({ action: 'setUserName', userId: state.id, value: v })
  }

  function startAbsorb(targetId: string) {
    setAbsorbing(targetId)
  }

  function confirmAbsorb(oldId: string, targetId: string, oldName: string, targetName: string) {
    if (!confirm(`Absorver "${oldName}" → "${targetName}"?\n\nIsso vai transferir todas as bandas e slots do primeiro para o segundo e deletar a conta antiga.`)) return
    onPatch({ action: 'absorbUser', oldUserId: oldId, targetUserId: targetId })
    setAbsorbing(null)
  }

  return (
    <div className="space-y-4">
      {absorbing && (
        <div className="bg-amber-950 border border-amber-700 rounded-xl p-4 text-sm text-amber-200">
          <p className="mb-2 font-medium">Selecione a conta que vai <span className="text-white">receber</span> tudo da conta abaixo:</p>
          <div className="space-y-1">
            {users.filter(u => u.id !== absorbing).map(u => (
              <button key={u.id} onClick={() => confirmAbsorb(absorbing, u.id, users.find(x => x.id === absorbing)!.name, u.name)}
                className="block w-full text-left px-3 py-2 rounded-lg bg-amber-900/50 hover:bg-amber-800 transition-colors">
                <span className="font-medium">{u.name}</span>
                <span className="ml-2 text-amber-400 text-xs">{u.email ?? 'sem email'}</span>
                <code className="ml-2 text-[10px] text-amber-600">{u.id}</code>
              </button>
            ))}
          </div>
          <button onClick={() => setAbsorbing(null)} className="mt-2 text-xs text-amber-500 hover:text-amber-300">Cancelar</button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-800">
            <Th>Nome</Th><Th>E-mail</Th><Th>ID</Th><Th>Bandas criadas</Th><Th>Criado em</Th><Th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={`border-b border-gray-900 hover:bg-gray-900/50 transition-colors ${absorbing === u.id ? 'opacity-40' : ''}`}>
              <Td className="font-medium">
                <Editable id={u.id} field="userName" value={u.name} editing={editing} setEditing={setEditing} onSave={save} />
              </Td>
              <Td className="text-gray-400 text-xs">{u.email ?? <span className="text-gray-700">—</span>}</Td>
              <Td><code className="text-[10px] text-gray-600 font-mono">{u.id}</code></Td>
              <Td className="text-gray-400">{u.bandsCreated}</Td>
              <Td className="text-gray-500 text-xs">{fmtDate(u.createdAt)}</Td>
              <Td>
                <div className="flex gap-3">
                  {users.length > 1 && (
                    <button onClick={() => startAbsorb(u.id)} className="text-xs text-gray-600 hover:text-amber-400">absorver →</button>
                  )}
                  <button onClick={() => onDelete('user', u.id, `usuário "${u.name}"`)} className="text-xs text-gray-600 hover:text-red-400">deletar</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Members table ────────────────────────────────────────────────────────────

function MembersTable({
  members, onDelete, onResetClaim, onPatch,
}: {
  members: AdminMember[]
  onDelete: (type: string, id: string, label: string) => void
  onResetClaim: (memberId: string, memberName: string) => void
  onPatch: (body: Record<string, unknown>) => void
}) {
  const [editing, setEditing] = useState<EditState | null>(null)

  function save(state: EditState) {
    const v = state.value.trim(); if (!v) return
    onPatch({ action: 'setMemberName', memberId: state.id, value: v })
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-800">
          <Th>Membro</Th><Th>Banda</Th><Th>Status</Th><Th>Claimed by</Th><Th>Claimed em</Th><Th />
        </tr>
      </thead>
      <tbody>
        {members.map((m) => (
          <tr key={m.id} className="border-b border-gray-900 hover:bg-gray-900/50 transition-colors">
            <Td>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                <Editable id={m.id} field="memberName" value={m.displayName} editing={editing} setEditing={setEditing} onSave={save} />
              </div>
            </Td>
            <Td className="text-gray-400">
              <span>{m.bandName}</span>
              <code className="block text-[10px] text-gray-600 font-mono">{m.bandInviteCode}</code>
            </Td>
            <Td>
              {m.claimedBy
                ? <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400">claimed</span>
                : <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">free</span>}
            </Td>
            <Td><code className="text-[10px] text-gray-600 font-mono">{m.claimedBy ?? '—'}</code></Td>
            <Td className="text-gray-600 text-xs">{m.claimedAt ? fmtDate(m.claimedAt) : '—'}</Td>
            <Td>
              <div className="flex gap-3">
                {m.claimedBy && (
                  <button onClick={() => onResetClaim(m.id, m.displayName)} className="text-xs text-gray-600 hover:text-amber-400">reset claim</button>
                )}
                <button onClick={() => onDelete('member', m.id, `membro "${m.displayName}"`)} className="text-xs text-gray-600 hover:text-red-400">deletar</button>
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SongsTable({ songs }: { songs: AdminSong[] }) {
  const sorted = [...songs].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-800">
          <Th>MÃºsica</Th><Th>Banda</Th><Th>BPM</Th><Th>Tom</Th><Th>Criada em</Th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((s) => (
          <tr key={s.id} className="border-b border-gray-900 hover:bg-gray-900/50 transition-colors">
            <Td className="font-medium text-gray-100">{s.name}</Td>
            <Td className="text-gray-400">
              <span>{s.bandName}</span>
              <code className="block text-[10px] text-gray-600 font-mono">{s.bandInviteCode}</code>
            </Td>
            <Td className="text-gray-400">{s.bpm ?? 'â€”'}</Td>
            <Td className="text-gray-400">{s.tonality ?? 'â€”'}</Td>
            <Td className="text-gray-500 text-xs">{fmtDate(s.createdAt)}</Td>
          </tr>
        ))}
        {sorted.length === 0 && (
          <tr>
            <Td colSpan={5} className="text-gray-600 text-xs py-5">Nenhuma mÃºsica cadastrada.</Td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium text-xs uppercase tracking-wider whitespace-nowrap">{children}</th>
}

function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`px-3 py-2.5 ${className ?? ''}`}>{children}</td>
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
