'use client'

import Calendar from '@/components/Calendar'
import BandHistoryPanel from '@/components/BandHistoryPanel'
import { useBand } from '@/contexts/BandContext'
import { useParams } from 'next/navigation'

export default function RehearsalsPage() {
  const { inviteCode } = useParams() as { inviteCode: string }
  const { band, currentMember, isAdmin, refetch } = useBand()

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 dark:text-gray-100">Próximas 8 semanas</h2>
      <Calendar
        inviteCode={inviteCode}
        currentMember={currentMember}
        allMembers={band.members}
        rehearsalDate={band.rehearsalDate}
        rehearsalTime={band.rehearsalTime}
        rehearsalNote={band.rehearsalNote}
        isAdmin={isAdmin}
        onScheduleChange={refetch}
      />
      <BandHistoryPanel inviteCode={inviteCode} type="rehearsal" title="Historico de ensaios" />
    </div>
  )
}
