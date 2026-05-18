export type AvailabilityStatus = 'available' | 'unavailable'
export type SongStatus = 'none' | 'partial' | 'full'

export interface BandMember {
  id: string
  bandId: string
  displayName: string
  color: string
  sortOrder: number
  claimed: boolean
  claimedBy: string | null
}

export interface BandHistoryEvent {
  id: number
  bandId: string
  actorMemberId: string | null
  actorName: string | null
  type: string
  subjectType: string
  subjectId: string | null
  subjectName: string | null
  details: Record<string, unknown>
  createdAt: string
}

export interface Band {
  id: string
  name: string
  inviteCode: string
  createdBy: string
  createdAt: string
  rehearsalDate: string | null
  rehearsalTime: string | null
  rehearsalNote: string | null
  members: BandMember[]
}

export interface Availability {
  id: number
  bandMemberId: string
  date: string
  status: AvailabilityStatus
}

export interface Song {
  id: number
  name: string
  createdAt: string
  // keyed by bandMemberId
  statuses: Record<string, SongStatus>
  rehearsed: SongStatus
}

export interface Suggestion {
  id: number
  name: string
  suggestedBy: string
  createdAt: string
  // keyed by bandMemberId → 'yes' | 'no'
  votes: Record<string, string>
}
