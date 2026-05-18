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

export interface Band {
  id: string
  name: string
  inviteCode: string
  createdBy: string
  createdAt: string
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
