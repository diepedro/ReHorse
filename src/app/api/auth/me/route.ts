import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, bands } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  })
  if (!user)
    return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email ?? null,
    recoveryCode: user.recoveryCode ?? null,
    hasPassword: !!user.passwordHash,
  })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Delete bands created by user first (cascade handles members/songs)
  await db.delete(bands).where(eq(bands.createdBy, session.user.id))
  await db.delete(users).where(eq(users.id, session.user.id))

  return NextResponse.json({ ok: true })
}
