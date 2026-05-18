export const MEMBER_COLORS = [
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#06B6D4',
  '#84CC16',
  '#6B7280',
  '#1D4ED8',
] as const

export function normalizeMemberColor(color: string) {
  return color.trim().toUpperCase()
}

export function isMemberColor(color: string) {
  return MEMBER_COLORS.includes(normalizeMemberColor(color) as typeof MEMBER_COLORS[number])
}

export function hasUnusedMemberColor(
  members: Array<{ id: string; color: string }>,
  ignoredMemberId?: string,
) {
  const used = new Set(
    members
      .filter((member) => member.id !== ignoredMemberId)
      .map((member) => normalizeMemberColor(member.color)),
  )
  return MEMBER_COLORS.some((color) => !used.has(color))
}

export function isColorBlocked(
  members: Array<{ id: string; color: string }>,
  color: string,
  targetMemberId?: string,
) {
  const normalized = normalizeMemberColor(color)
  const usedByOther = members.some(
    (member) => member.id !== targetMemberId && normalizeMemberColor(member.color) === normalized,
  )
  return usedByOther && hasUnusedMemberColor(members, targetMemberId)
}

export function firstAvailableMemberColor(members: Array<{ id: string; color: string }>) {
  const used = new Set(members.map((member) => normalizeMemberColor(member.color)))
  return MEMBER_COLORS.find((color) => !used.has(color)) ?? MEMBER_COLORS[0]
}
