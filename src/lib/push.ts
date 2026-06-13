import webpush from 'web-push'
import { db } from './db'
import { bandMembers, bandNotificationRecipients, pushSubscriptions } from './schema'
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
  notificationId?: number
}

export interface PushResult {
  skipped: boolean
  reason?: string
  users: number
  subscriptions: number
  sent: number
  failed: number
}

interface PushOptions {
  excludeMemberId?: string
  notificationId?: number
  targetMemberIds?: string[]
}

/**
 * Sends a push notification to all active band members (who claimed their slot).
 * Optionally excludes one member (e.g. the one who triggered the action).
 */
export async function pushToBand(
  bandId: string,
  payload: PushPayload,
  excludeMemberIdOrOptions?: string | PushOptions,
) {
  const options = typeof excludeMemberIdOrOptions === 'string'
    ? { excludeMemberId: excludeMemberIdOrOptions }
    : excludeMemberIdOrOptions ?? {}

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return {
      skipped: true,
      reason: 'push_not_configured',
      users: 0,
      subscriptions: 0,
      sent: 0,
      failed: 0,
    } satisfies PushResult
  }

  const members = await db.query.bandMembers.findMany({
    where: eq(bandMembers.bandId, bandId),
  })
  const targetMemberIds = options.targetMemberIds ? new Set(options.targetMemberIds) : null
  const targetMembers = members.filter((m) => (
    (!targetMemberIds || targetMemberIds.has(m.id)) &&
    m.id !== options.excludeMemberId
  ))

  const userIds = Array.from(new Set(
    targetMembers
      .filter((m) => m.claimedBy)
      .map((m) => m.claimedBy!)
  ))

  if (userIds.length === 0) {
    return {
      skipped: true,
      reason: 'no_claimed_members',
      users: 0,
      subscriptions: 0,
      sent: 0,
      failed: 0,
    } satisfies PushResult
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds))

  const subsByUserId = new Map<string, typeof subs>()
  for (const sub of subs) {
    if (!sub.userId) continue
    const current = subsByUserId.get(sub.userId) ?? []
    current.push(sub)
    subsByUserId.set(sub.userId, current)
  }

  if (options.notificationId) {
    for (const member of targetMembers.filter((m) => m.claimedBy)) {
      const memberSubs = subsByUserId.get(member.claimedBy!) ?? []
      if (memberSubs.length === 0) {
        await db.insert(bandNotificationRecipients).values({
          notificationId: options.notificationId,
          bandMemberId: member.id,
          displayName: member.displayName,
          userId: member.claimedBy,
          endpoint: null,
          status: 'no_subscription',
        })
      }
    }
  }

  if (subs.length === 0) {
    return {
      skipped: true,
      reason: 'no_subscriptions',
      users: userIds.length,
      subscriptions: 0,
      sent: 0,
      failed: 0,
    } satisfies PushResult
  }

  const trackedPayload = options.notificationId
    ? { ...payload, notificationId: options.notificationId }
    : payload
  const message = JSON.stringify(trackedPayload)

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      const member = targetMembers.find((m) => m.claimedBy === sub.userId)
      const [recipient] = options.notificationId && member
        ? await db.insert(bandNotificationRecipients).values({
            notificationId: options.notificationId,
            bandMemberId: member.id,
            displayName: member.displayName,
            userId: sub.userId,
            endpoint: sub.endpoint,
            status: 'queued',
          }).returning()
        : [null]

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
        )
        if (recipient) {
          await db.update(bandNotificationRecipients)
            .set({ status: 'sent', sentAt: new Date(), error: null })
            .where(eq(bandNotificationRecipients.id, recipient.id))
        }
      } catch (error) {
        if (recipient) {
          await db.update(bandNotificationRecipients)
            .set({ status: 'failed', error: getPushErrorMessage(error) })
            .where(eq(bandNotificationRecipients.id, recipient.id))
        }
        throw error
      }
    }),
  )

  return {
    skipped: false,
    users: userIds.length,
    subscriptions: subs.length,
    sent: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length,
  } satisfies PushResult
}

function getPushErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500)
  return 'Unknown push error'
}
