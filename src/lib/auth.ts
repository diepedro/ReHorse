import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { randomBytes, scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import { db } from './db'
import { users } from './schema'
import { eq } from 'drizzle-orm'

const scryptAsync = promisify(scrypt)

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [salt, key] = hash.split(':')
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
    const keyBuffer = Buffer.from(key, 'hex')
    return timingSafeEqual(derivedKey, keyBuffer)
  } catch {
    return false
  }
}

export function generateRecoveryCode(): string {
  // 18 random chars, URL-safe, grouped for readability: XXXXXX-XXXXXX-XXXXXX
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(18)
  const raw = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
  return `${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}`
}

export const authOptions: NextAuthOptions = {
  providers: [
    // ── Re-auth with existing userId (localStorage creator_id fallback) ──────
    CredentialsProvider({
      id: 'anonymous',
      name: 'Anonymous',
      credentials: {
        existingId: { label: 'Existing ID', type: 'text' },
      },
      async authorize(credentials) {
        const existingId = credentials?.existingId?.trim()
        if (!existingId) return null

        const existing = await db.query.users.findFirst({
          where: eq(users.id, existingId),
        })
        if (!existing) return null

        // Back-fill recovery code for legacy accounts that don't have one
        if (!existing.recoveryCode) {
          const recoveryCode = generateRecoveryCode()
          await db.update(users).set({ recoveryCode }).where(eq(users.id, existingId))
        }

        return { id: existing.id, name: existing.name }
      },
    }),

    // ── Email + password ─────────────────────────────────────────────────────
    CredentialsProvider({
      id: 'email-password',
      name: 'Email e Senha',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password
        if (!email || !password) return null

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        })
        if (!user?.passwordHash) return null

        const valid = await verifyPassword(password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, name: user.name }
      },
    }),

    // ── Recovery code ────────────────────────────────────────────────────────
    CredentialsProvider({
      id: 'recovery-code',
      name: 'Código de Recuperação',
      credentials: {
        code: { label: 'Código', type: 'text' },
      },
      async authorize(credentials) {
        const code = credentials?.code?.trim().toUpperCase()
        if (!code) return null

        const user = await db.query.users.findFirst({
          where: eq(users.recoveryCode, code),
        })
        if (!user) return null

        return { id: user.id, name: user.name }
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.userName = user.name ?? ''
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string
        session.user.name = token.userName as string
      }
      return session
    },
  },

  pages: { signIn: '/auth/signin' },
  secret: process.env.NEXTAUTH_SECRET,
}
