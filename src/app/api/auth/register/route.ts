import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { hashPassword, generateRecoveryCode } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, password } = body

  if (!name?.trim())
    return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const normalizedEmail = email?.trim().toLowerCase() || null

  // Email uniqueness check
  if (normalizedEmail) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    })
    if (existing)
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
  }

  // Require password when email is provided
  if (normalizedEmail && !password?.trim())
    return NextResponse.json({ error: 'Senha obrigatória ao informar e-mail' }, { status: 400 })

  const id = randomUUID()
  const recoveryCode = generateRecoveryCode()
  const passwordHash =
    normalizedEmail && password ? await hashPassword(password) : null

  await db.insert(users).values({
    id,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    recoveryCode,
  })

  return NextResponse.json({ userId: id, recoveryCode }, { status: 201 })
}
