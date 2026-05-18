import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { bandMembers } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// POST /api/auth/merge — link anon member slots to the current user account
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { memberIds } = await req.json()
  if (!Array.isArray(memberIds) || memberIds.length === 0)
    return NextResponse.json({ error: 'memberIds required' }, { status: 400 })

  for (const memberId of memberIds) {
    await db
      .update(bandMembers)
      .set({ claimedBy: session.user.id, claimedAt: new Date() })
      .where(eq(bandMembers.id, memberId))
  }

  return NextResponse.json({ ok: true })
}
