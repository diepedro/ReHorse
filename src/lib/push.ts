import webpush from 'web-push'
import { db } from './db'
import { bandMembers, pushSubscriptions } from './schema'
import { eq, inArray } from 'drizzle-orm'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL ?? 'noreply@rehorse.app'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

/**
 * Sends a push notification to all active band members (who claimed their slot).
 * Optionally excludes one member (e.g. the one who triggered the action).
 */
export async function pushToBand(
  bandId: string,
  payload: PushPayload,
  excludeMemberId?: string,
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return

  const members = await db.query.bandMembers.findMany({
    where: eq(bandMembers.bandId, bandId),
  })

  const userIds = members
    .filter((m) => m.claimedBy && m.id !== excludeMemberId)
    .map((m) => m.claimedBy!)

  if (userIds.length === 0) return

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds))

  if (subs.length === 0) return

  const message = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message,
      )
    ),
  )
}
