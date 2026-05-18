import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, bands, bandMembers, songs } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

// GET /api/admin — full snapshot
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const allUsers    = await db.select().from(users).orderBy(users.createdAt)
  const allBands    = await db.select().from(bands).orderBy(bands.createdAt)
  const allMembers  = await db.select().from(bandMembers).orderBy(bandMembers.sortOrder)
  const allSongs    = await db.select().from(songs)

  const usersEnriched = allUsers.map((u) => ({
    ...u,
    bandsCreated: allBands.filter((b) => b.createdBy === u.id).length,
    slotsJoined:  allMembers.filter((m) => m.claimedBy !== null && m.claimedBy === `anon:${m.id}`).length,
  }))

  const bandsEnriched = allBands.map((b) => ({
    ...b,
    creatorName:  allUsers.find((u) => u.id === b.createdBy)?.name ?? '?',
    memberCount:  allMembers.filter((m) => m.bandId === b.id).length,
    claimedCount: allMembers.filter((m) => m.bandId === b.id && m.claimedBy !== null).length,
    songCount:    allSongs.filter((s) => s.bandId === b.id).length,
    songs:        allSongs
      .filter((s) => s.bandId === b.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        bpm: s.bpm,
        tonality: s.tonality,
        createdAt: s.createdAt,
      })),
    members:      allMembers
      .filter((m) => m.bandId === b.id)
      .map((m) => ({ id: m.id, displayName: m.displayName, color: m.color, claimedBy: m.claimedBy, claimedAt: m.claimedAt })),
  }))

  const membersEnriched = allMembers.map((m) => ({
    ...m,
    bandName:       allBands.find((b) => b.id === m.bandId)?.name ?? '?',
    bandInviteCode: allBands.find((b) => b.id === m.bandId)?.inviteCode ?? '?',
  }))

  const songsEnriched = allSongs.map((s) => ({
    ...s,
    bandName: allBands.find((b) => b.id === s.bandId)?.name ?? '?',
    bandInviteCode: allBands.find((b) => b.id === s.bandId)?.inviteCode ?? '?',
  }))

  return NextResponse.json({ users: usersEnriched, bands: bandsEnriched, members: membersEnriched, songs: songsEnriched })
}

// DELETE /api/admin?type=user&id=xxx  |  type=band  |  type=member
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const id   = searchParams.get('id')

  if (!type || !id) return NextResponse.json({ error: 'type and id required' }, { status: 400 })

  if (type === 'user') {
    await db.delete(bands).where(eq(bands.createdBy, id))
    await db.delete(users).where(eq(users.id, id))
  } else if (type === 'band') {
    await db.delete(bands).where(eq(bands.id, id))
  } else if (type === 'member') {
    await db.delete(bandMembers).where(eq(bandMembers.id, id))
  } else {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

// PATCH /api/admin — multi-action edit
export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { action } = body

  if (action === 'resetClaim') {
    const { memberId } = body
    if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })
    await db.update(bandMembers).set({ claimedBy: null, claimedAt: null }).where(eq(bandMembers.id, memberId))

  } else if (action === 'setInviteCode') {
    const { bandId, value } = body
    if (!bandId || !value?.trim()) return NextResponse.json({ error: 'bandId and value required' }, { status: 400 })
    // Check uniqueness
    const existing = await db.query.bands.findFirst({ where: eq(bands.inviteCode, value.trim()) })
    if (existing && existing.id !== bandId)
      return NextResponse.json({ error: 'Invite code already in use' }, { status: 409 })
    await db.update(bands).set({ inviteCode: value.trim() }).where(eq(bands.id, bandId))

  } else if (action === 'setBandName') {
    const { bandId, value } = body
    if (!bandId || !value?.trim()) return NextResponse.json({ error: 'bandId and value required' }, { status: 400 })
    await db.update(bands).set({ name: value.trim() }).where(eq(bands.id, bandId))

  } else if (action === 'setUserName') {
    const { userId, value } = body
    if (!userId || !value?.trim()) return NextResponse.json({ error: 'userId and value required' }, { status: 400 })
    await db.update(users).set({ name: value.trim() }).where(eq(users.id, userId))

  } else if (action === 'setMemberName') {
    const { memberId, value } = body
    if (!memberId || !value?.trim()) return NextResponse.json({ error: 'memberId and value required' }, { status: 400 })
    await db.update(bandMembers).set({ displayName: value.trim() }).where(eq(bandMembers.id, memberId))

  } else if (action === 'setMemberColor') {
    const { memberId, value } = body
    if (!memberId || !value) return NextResponse.json({ error: 'memberId and value required' }, { status: 400 })
    await db.update(bandMembers).set({ color: value }).where(eq(bandMembers.id, memberId))

  } else if (action === 'absorbUser') {
    // Transfer all bands and member slots from oldUserId → targetUserId, then delete old user
    const { oldUserId, targetUserId } = body
    if (!oldUserId || !targetUserId)
      return NextResponse.json({ error: 'oldUserId and targetUserId required' }, { status: 400 })
    if (oldUserId === targetUserId)
      return NextResponse.json({ error: 'Same user' }, { status: 400 })
    await db.update(bands).set({ createdBy: targetUserId }).where(eq(bands.createdBy, oldUserId))
    await db.update(bandMembers).set({ claimedBy: targetUserId }).where(eq(bandMembers.claimedBy, oldUserId))
    await db.delete(users).where(eq(users.id, oldUserId))

  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
