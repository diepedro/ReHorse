'use client'

import Calendar from '@/components/Calendar'
import { useBand } from '@/contexts/BandContext'
import { useParams } from 'next/navigation'

export default function RehearsalsPage() {
  const { inviteCode } = useParams() as { inviteCode: string }
  const { band, currentMember, isAdmin, readOnly, refetch } = useBand()

  return (
    <div>
      <h2 className="party-title mb-4 text-2xl">Próximas 8 semanas</h2>
      <Calendar
        inviteCode={inviteCode}
        currentMember={currentMember}
        allMembers={band.members}
        rehearsalDate={band.rehearsalDate}
        rehearsalTime={band.rehearsalTime}
        rehearsalNote={band.rehearsalNote}
        isAdmin={isAdmin}
        readOnly={readOnly}
        onScheduleChange={refetch}
      />
    </div>
  )
}
