/**
 * One-time migration: SQLite → Postgres
 *
 * Run AFTER starting the Postgres container and BEFORE the app:
 *   1. docker compose up -d postgres
 *   2. Copy your Postgres URL to DATABASE_URL_LOCAL in .env
 *      e.g.  DATABASE_URL_LOCAL=postgresql://rehorse:rehorse_password@localhost:5433/rehorse
 *   3. npm run db:migrate-sqlite
 *
 * The script will:
 *   - Create a user account for Pedro (the original creator)
 *   - Create a legacy band with the existing member slots
 *   - Migrate all availability, songs, song_status, suggestions, suggestion_votes
 *   - Print the invite link for the band at the end
 */

import Database from 'better-sqlite3'
import postgres from 'postgres'
import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'
import 'dotenv/config'

// ── Config ────────────────────────────────────────────────────────────────────

const SQLITE_PATH = path.join(process.cwd(), 'data', 'rehorse.db')
const PG_URL = process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL

if (!PG_URL) {
  console.error('❌  Set DATABASE_URL_LOCAL (or DATABASE_URL) in your .env file.')
  process.exit(1)
}

if (!fs.existsSync(SQLITE_PATH)) {
  console.error(`❌  SQLite file not found at: ${SQLITE_PATH}`)
  process.exit(1)
}

// Legacy member mapping (old string key → new UUID)
const LEGACY_MEMBERS = [
  { key: 'pedro',    displayName: 'Pedro',    color: '#3B82F6', sortOrder: 0 },
  { key: 'romulo',   displayName: 'Romulo',   color: '#EF4444', sortOrder: 1 },
  { key: 'henrique', displayName: 'Henrique', color: '#10B981', sortOrder: 2 },
  { key: 'tagata',   displayName: 'Tagata',   color: '#F59E0B', sortOrder: 3 },
]

// ── Run ───────────────────────────────────────────────────────────────────────

async function run() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true })
  const sql = postgres(PG_URL!, { max: 1 })

  console.log('🔌  Connected to Postgres and SQLite.')

  // Ensure schema exists (tables from db.ts)
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bands (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      invite_code TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS band_members (
      id TEXT PRIMARY KEY,
      band_id TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL, color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      claimed_by TEXT REFERENCES users(id), claimed_at TIMESTAMPTZ,
      UNIQUE (band_id, display_name), UNIQUE (band_id, claimed_by)
    );
    CREATE TABLE IF NOT EXISTS availability (
      id SERIAL PRIMARY KEY,
      band_member_id TEXT NOT NULL REFERENCES band_members(id) ON DELETE CASCADE,
      date TEXT NOT NULL, status TEXT NOT NULL,
      UNIQUE (band_member_id, date)
    );
    CREATE TABLE IF NOT EXISTS songs (
      id SERIAL PRIMARY KEY,
      band_id TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
      name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS song_status (
      id SERIAL PRIMARY KEY,
      song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      band_member_id TEXT NOT NULL REFERENCES band_members(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'none', UNIQUE (song_id, band_member_id)
    );
    CREATE TABLE IF NOT EXISTS song_rehearsed (
      id SERIAL PRIMARY KEY,
      song_id INTEGER UNIQUE NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'none'
    );
    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      band_id TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      suggested_by TEXT NOT NULL REFERENCES band_members(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS suggestion_votes (
      id SERIAL PRIMARY KEY,
      suggestion_id INTEGER NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
      band_member_id TEXT NOT NULL REFERENCES band_members(id) ON DELETE CASCADE,
      vote TEXT NOT NULL, UNIQUE (suggestion_id, band_member_id)
    );
  `)
  console.log('✅  Schema ready.')

  // 1. Create admin user (Pedro)
  const adminId = randomUUID()
  await sql`
    INSERT INTO users (id, name) VALUES (${adminId}, 'Pedro')
    ON CONFLICT (id) DO NOTHING
  `
  console.log(`👤  Created user: Pedro (${adminId})`)

  // 2. Create legacy band
  const bandId = randomUUID()
  const inviteCode = 'rehorse'  // memorable code for existing band
  await sql`
    INSERT INTO bands (id, name, invite_code, created_by)
    VALUES (${bandId}, 'Rehorse', ${inviteCode}, ${adminId})
    ON CONFLICT (invite_code) DO NOTHING
  `
  console.log(`🎸  Created band: Rehorse (invite_code: ${inviteCode})`)

  // 3. Create band members and build key → id map
  const memberIdMap: Record<string, string> = {}
  for (const m of LEGACY_MEMBERS) {
    const memberId = randomUUID()
    memberIdMap[m.key] = memberId
    // Pedro claims his own slot
    const claimedBy = m.key === 'pedro' ? adminId : null
    await sql`
      INSERT INTO band_members (id, band_id, display_name, color, sort_order, claimed_by)
      VALUES (${memberId}, ${bandId}, ${m.displayName}, ${m.color}, ${m.sortOrder}, ${claimedBy})
      ON CONFLICT (band_id, display_name) DO NOTHING
    `
    console.log(`  👥  Member: ${m.displayName} → ${memberId}`)
  }

  // 4. Migrate availability
  const avail = sqlite.prepare('SELECT * FROM availability').all() as any[]
  let availMigrated = 0
  for (const row of avail) {
    const memberId = memberIdMap[row.member]
    if (!memberId) continue
    await sql`
      INSERT INTO availability (band_member_id, date, status)
      VALUES (${memberId}, ${row.date}, ${row.status})
      ON CONFLICT (band_member_id, date) DO UPDATE SET status = EXCLUDED.status
    `
    availMigrated++
  }
  console.log(`📅  Availability: ${availMigrated}/${avail.length} records migrated.`)

  // 5. Migrate songs + song_status + song_rehearsed
  const oldSongs = sqlite.prepare('SELECT * FROM songs ORDER BY id').all() as any[]
  const songIdMap: Record<number, number> = {}

  for (const song of oldSongs) {
    const [newSong] = await sql`
      INSERT INTO songs (band_id, name, created_at)
      VALUES (${bandId}, ${song.name}, ${song.created_at ?? new Date().toISOString()})
      RETURNING id
    `
    songIdMap[song.id] = newSong.id
  }
  console.log(`🎵  Songs: ${oldSongs.length} migrated.`)

  const oldStatuses = sqlite.prepare('SELECT * FROM song_status').all() as any[]
  let statusMigrated = 0
  for (const row of oldStatuses) {
    const newSongId = songIdMap[row.song_id]
    const memberId = memberIdMap[row.member]
    if (!newSongId || !memberId) continue
    await sql`
      INSERT INTO song_status (song_id, band_member_id, status)
      VALUES (${newSongId}, ${memberId}, ${row.status})
      ON CONFLICT (song_id, band_member_id) DO UPDATE SET status = EXCLUDED.status
    `
    statusMigrated++
  }
  console.log(`  🎼  Song statuses: ${statusMigrated} migrated.`)

  const oldRehearsed = sqlite.prepare('SELECT * FROM song_rehearsed').all() as any[]
  for (const row of oldRehearsed) {
    const newSongId = songIdMap[row.song_id]
    if (!newSongId) continue
    await sql`
      INSERT INTO song_rehearsed (song_id, status)
      VALUES (${newSongId}, ${row.status})
      ON CONFLICT (song_id) DO UPDATE SET status = EXCLUDED.status
    `
  }
  console.log(`  🎤  Rehearsed statuses: ${oldRehearsed.length} migrated.`)

  // 6. Migrate suggestions + votes
  const oldSuggestions = sqlite.prepare('SELECT * FROM suggestions ORDER BY id').all() as any[]
  const suggestionIdMap: Record<number, number> = {}

  for (const s of oldSuggestions) {
    const memberId = memberIdMap[s.suggested_by]
    if (!memberId) continue
    const [newSugg] = await sql`
      INSERT INTO suggestions (band_id, name, suggested_by, created_at)
      VALUES (${bandId}, ${s.name}, ${memberId}, ${s.created_at ?? new Date().toISOString()})
      RETURNING id
    `
    suggestionIdMap[s.id] = newSugg.id
  }
  console.log(`💡  Suggestions: ${oldSuggestions.length} migrated.`)

  const oldVotes = sqlite.prepare('SELECT * FROM suggestion_votes').all() as any[]
  let votesMigrated = 0
  for (const row of oldVotes) {
    const newSuggId = suggestionIdMap[row.suggestion_id]
    const memberId = memberIdMap[row.member]
    if (!newSuggId || !memberId) continue
    await sql`
      INSERT INTO suggestion_votes (suggestion_id, band_member_id, vote)
      VALUES (${newSuggId}, ${memberId}, ${row.vote})
      ON CONFLICT (suggestion_id, band_member_id) DO UPDATE SET vote = EXCLUDED.vote
    `
    votesMigrated++
  }
  console.log(`  🗳  Votes: ${votesMigrated} migrated.`)

  sqlite.close()
  await sql.end()

  console.log(`
✅  Migration complete!

  Band invite link: /join/${inviteCode}
  Pedro's user ID:  ${adminId}

  Next steps:
  1. Start the app:  docker compose up --build -d
  2. Open the invite link and claim your slot (Pedro)
  3. Share the link with Romulo, Henrique and Tagata
  `)
}

run().catch((err) => {
  console.error('❌  Migration failed:', err)
  process.exit(1)
})
