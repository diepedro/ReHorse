import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, bands, bandMembers } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// POST /api/auth/absorb
// Merges an old account into the current one, transferring band ownership and member slots.
// Body: { recoveryCode: string } | { oldUserId: string }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const newUserId = session.user.id
  const body = await req.json()

  let oldUser: typeof users.$inferSelect | undefined

  if (body.recoveryCode) {
    const code = (body.recoveryCode as string).trim().toUpperCase()
    oldUser = await db.query.users.findFirst({ where: eq(users.recoveryCode, code) })
  } else if (body.oldUserId) {
    oldUser = await db.query.users.findFirst({ where: eq(users.id, body.oldUserId) })
  }

  if (!oldUser)
    return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 })

  if (oldUser.id === newUserId)
    return NextResponse.json({ error: 'Essa já é a sua conta atual.' }, { status: 400 })

  // Transfer band ownership
  await db.update(bands).set({ createdBy: newUserId }).where(eq(bands.createdBy, oldUser.id))

  // Transfer claimed member slots
  await db.update(bandMembers).set({ claimedBy: newUserId }).where(eq(bandMembers.claimedBy, oldUser.id))

  // Delete the old account
  await db.delete(users).where(eq(users.id, oldUser.id))

  return NextResponse.json({ ok: true, transferredFrom: oldUser.name })
}
