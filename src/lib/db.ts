import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var _pgClient: postgres.Sql | undefined
}

function createClient() {
  const url = process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL_LOCAL or DATABASE_URL is not set')
  return postgres(url, { max: 10 })
}

const client = global._pgClient ?? createClient()
if (process.env.NODE_ENV !== 'production') global._pgClient = client

export const db = drizzle(client, { schema })

const TRANSIENT_DB_ERRORS = new Set([
  '57P03',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
])

function isTransientDbError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const maybeError = error as { code?: string; cause?: unknown }
  if (maybeError.code && TRANSIENT_DB_ERRORS.has(maybeError.code)) return true

  if (maybeError.cause && typeof maybeError.cause === 'object') {
    const causeCode = (maybeError.cause as { code?: string }).code
    if (causeCode && TRANSIENT_DB_ERRORS.has(causeCode)) return true
  }

  return false
}

async function retryDbOperation<T>(operation: () => Promise<T>, attempts = 30, delayMs = 1000): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isTransientDbError(error) || attempt === attempts) throw error
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

// Schema bootstrap
// Runs once on server start via src/instrumentation.ts.
// Uses raw SQL so no migration files need to be committed.

let initialized = false

export async function initDb() {
  if (initialized) return
  initialized = true

  try {
    await retryDbOperation(async () => {
      await client.unsafe(`
        CREATE TABLE IF NOT EXISTS users (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bands (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          invite_code TEXT UNIQUE NOT NULL,
          created_by  TEXT NOT NULL REFERENCES users(id),
          created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS band_members (
          id           TEXT PRIMARY KEY,
          band_id      TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
          display_name TEXT NOT NULL,
          color        TEXT NOT NULL,
          sort_order   INTEGER NOT NULL DEFAULT 0,
          claimed_by   TEXT,
          claimed_at   TIMESTAMPTZ,
          UNIQUE (band_id, display_name),
          UNIQUE (band_id, claimed_by)
        );

        CREATE TABLE IF NOT EXISTS availability (
          id             SERIAL PRIMARY KEY,
          band_member_id TEXT NOT NULL REFERENCES band_members(id) ON DELETE CASCADE,
          date           TEXT NOT NULL,
          status         TEXT NOT NULL,
          UNIQUE (band_member_id, date)
        );

        CREATE TABLE IF NOT EXISTS songs (
          id         SERIAL PRIMARY KEY,
          band_id    TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
          name       TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS song_status (
          id             SERIAL PRIMARY KEY,
          song_id        INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
          band_member_id TEXT NOT NULL REFERENCES band_members(id) ON DELETE CASCADE,
          status         TEXT NOT NULL DEFAULT 'none',
          UNIQUE (song_id, band_member_id)
        );

        CREATE TABLE IF NOT EXISTS song_rehearsed (
          id      SERIAL PRIMARY KEY,
          song_id INTEGER UNIQUE NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
          status  TEXT NOT NULL DEFAULT 'none'
        );

        CREATE TABLE IF NOT EXISTS suggestions (
          id           SERIAL PRIMARY KEY,
          band_id      TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
          name         TEXT NOT NULL,
          suggested_by TEXT NOT NULL REFERENCES band_members(id) ON DELETE CASCADE,
          created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS suggestion_votes (
          id             SERIAL PRIMARY KEY,
          suggestion_id  INTEGER NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
          band_member_id TEXT NOT NULL REFERENCES band_members(id) ON DELETE CASCADE,
          vote           TEXT NOT NULL,
          UNIQUE (suggestion_id, band_member_id)
        );
      `)

      await client.unsafe(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_code TEXT UNIQUE;

        CREATE TABLE IF NOT EXISTS rehearsal_sessions (
          id           SERIAL PRIMARY KEY,
          band_id      TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
          created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          ended_at     TIMESTAMPTZ,
          song_order   TEXT NOT NULL DEFAULT '[]',
          played_songs TEXT NOT NULL DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id         SERIAL PRIMARY KEY,
          user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
          endpoint   TEXT NOT NULL UNIQUE,
          p256dh     TEXT NOT NULL,
          auth       TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS band_announcements (
          id         SERIAL PRIMARY KEY,
          band_id    TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
          author_id  TEXT REFERENCES band_members(id) ON DELETE SET NULL,
          content    TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS song_references (
          id         SERIAL PRIMARY KEY,
          song_id    INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
          type       TEXT NOT NULL,
          ref_id     TEXT NOT NULL,
          title      TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS song_comments (
          id         SERIAL PRIMARY KEY,
          song_id    INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
          author_id  TEXT REFERENCES band_members(id) ON DELETE SET NULL,
          content    TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );

        ALTER TABLE songs ADD COLUMN IF NOT EXISTS bpm INTEGER;
        ALTER TABLE songs ADD COLUMN IF NOT EXISTS tonality TEXT;
        ALTER TABLE songs ADD COLUMN IF NOT EXISTS notes TEXT;

        ALTER TABLE song_references ADD COLUMN IF NOT EXISTS preview_url TEXT;
        ALTER TABLE song_references ADD COLUMN IF NOT EXISTS artwork_url TEXT;
        ALTER TABLE song_references ADD COLUMN IF NOT EXISTS artist_name TEXT;
      `)
    })
  } catch (error) {
    initialized = false
    throw error
  }
}
