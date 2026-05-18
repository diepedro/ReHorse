import { db, initDb } from './db'
import { bandHistoryEvents } from './schema'

interface HistoryInput {
  bandId: string
  type: string
  subjectType: string
  actorMemberId?: string | null
  actorName?: string | null
  subjectId?: string | number | null
  subjectName?: string | null
  details?: unknown
}

export async function recordHistoryEvent(input: HistoryInput) {
  await initDb()
  await db.insert(bandHistoryEvents).values({
    bandId: input.bandId,
    actorMemberId: input.actorMemberId ?? null,
    actorName: input.actorName ?? null,
    type: input.type,
    subjectType: input.subjectType,
    subjectId: input.subjectId == null ? null : String(input.subjectId),
    subjectName: input.subjectName ?? null,
    details: JSON.stringify(input.details ?? {}),
  })
}
