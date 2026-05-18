import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Users (band creators — anonymous account) ───────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  recoveryCode: text('recovery_code').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Bands ────────────────────────────────────────────────────────────────────

export const bands = pgTable('bands', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').unique().notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  rehearsalDate: text('rehearsal_date'),
  rehearsalTime: text('rehearsal_time'),
  rehearsalNote: text('rehearsal_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Band Members (slots defined by creator, claimed by joiners) ──────────────

export const bandMembers = pgTable(
  'band_members',
  {
    id: text('id').primaryKey(),
    bandId: text('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    color: text('color').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    claimedBy: text('claimed_by'),
    claimedAt: timestamp('claimed_at'),
  },
  (t) => [
    unique('uq_band_member_name').on(t.bandId, t.displayName),
    unique('uq_band_member_claimed').on(t.bandId, t.claimedBy),
  ]
)

// ─── Availability ─────────────────────────────────────────────────────────────

export const availability = pgTable(
  'availability',
  {
    id: serial('id').primaryKey(),
    bandMemberId: text('band_member_id')
      .notNull()
      .references(() => bandMembers.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    status: text('status').notNull(),
  },
  (t) => [unique('uq_availability').on(t.bandMemberId, t.date)]
)

// ─── Songs ────────────────────────────────────────────────────────────────────

export const songs = pgTable('songs', {
  id: serial('id').primaryKey(),
  bandId: text('band_id')
    .notNull()
    .references(() => bands.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  bpm: integer('bpm'),
  tonality: text('tonality'),
  notes: text('notes'),
})

// ─── Song Status (per-member learning progress) ───────────────────────────────

export const songStatus = pgTable(
  'song_status',
  {
    id: serial('id').primaryKey(),
    songId: integer('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    bandMemberId: text('band_member_id')
      .notNull()
      .references(() => bandMembers.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('none'),
  },
  (t) => [unique('uq_song_status').on(t.songId, t.bandMemberId)]
)

// ─── Song Rehearsed (band-level rehearsal status) ─────────────────────────────

export const songRehearsed = pgTable('song_rehearsed', {
  id: serial('id').primaryKey(),
  songId: integer('song_id')
    .notNull()
    .references(() => songs.id, { onDelete: 'cascade' })
    .unique(),
  status: text('status').notNull().default('none'),
})

// ─── Suggestions ──────────────────────────────────────────────────────────────

export const suggestions = pgTable('suggestions', {
  id: serial('id').primaryKey(),
  bandId: text('band_id')
    .notNull()
    .references(() => bands.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  suggestedBy: text('suggested_by')
    .notNull()
    .references(() => bandMembers.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Suggestion Votes ─────────────────────────────────────────────────────────

export const suggestionVotes = pgTable(
  'suggestion_votes',
  {
    id: serial('id').primaryKey(),
    suggestionId: integer('suggestion_id')
      .notNull()
      .references(() => suggestions.id, { onDelete: 'cascade' }),
    bandMemberId: text('band_member_id')
      .notNull()
      .references(() => bandMembers.id, { onDelete: 'cascade' }),
    vote: text('vote').notNull(),
  },
  (t) => [unique('uq_suggestion_vote').on(t.suggestionId, t.bandMemberId)]
)

// ─── Rehearsal Sessions ───────────────────────────────────────────────────────

export const rehearsalSessions = pgTable('rehearsal_sessions', {
  id: serial('id').primaryKey(),
  bandId: text('band_id').notNull().references(() => bands.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  songOrder: text('song_order').notNull().default('[]'),   // JSON: number[]
  playedSongs: text('played_songs').notNull().default('[]'), // JSON: number[]
})

// Band History Events

export const bandHistoryEvents = pgTable('band_history_events', {
  id: serial('id').primaryKey(),
  bandId: text('band_id').notNull().references(() => bands.id, { onDelete: 'cascade' }),
  actorMemberId: text('actor_member_id').references(() => bandMembers.id, { onDelete: 'set null' }),
  actorName: text('actor_name'),
  type: text('type').notNull(),
  subjectType: text('subject_type').notNull(),
  subjectId: text('subject_id'),
  subjectName: text('subject_name'),
  details: text('details').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Push Subscriptions ───────────────────────────────────────────────────────

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Band Announcements ───────────────────────────────────────────────────────

export const bandAnnouncements = pgTable('band_announcements', {
  id: serial('id').primaryKey(),
  bandId: text('band_id').notNull().references(() => bands.id, { onDelete: 'cascade' }),
  authorId: text('author_id').references(() => bandMembers.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Song References (YouTube / Spotify) ─────────────────────────────────────

export const songReferences = pgTable('song_references', {
  id: serial('id').primaryKey(),
  songId: integer('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'youtube' | 'spotify' | 'itunes'
  refId: text('ref_id').notNull(),
  title: text('title').notNull(),
  previewUrl: text('preview_url'),
  artworkUrl: text('artwork_url'),
  artistName: text('artist_name'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Song Comments ────────────────────────────────────────────────────────────

export const songComments = pgTable('song_comments', {
  id: serial('id').primaryKey(),
  songId: integer('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  authorId: text('author_id').references(() => bandMembers.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const bandsRelations = relations(bands, ({ one, many }) => ({
  creator: one(users, { fields: [bands.createdBy], references: [users.id] }),
  members: many(bandMembers),
  songs: many(songs),
  suggestions: many(suggestions),
}))

export const bandMembersRelations = relations(bandMembers, ({ one }) => ({
  band: one(bands, { fields: [bandMembers.bandId], references: [bands.id] }),
  claimedByUser: one(users, {
    fields: [bandMembers.claimedBy],
    references: [users.id],
  }),
}))

export const songsRelations = relations(songs, ({ one, many }) => ({
  band: one(bands, { fields: [songs.bandId], references: [bands.id] }),
  statuses: many(songStatus),
  rehearsed: one(songRehearsed, {
    fields: [songs.id],
    references: [songRehearsed.songId],
  }),
}))
