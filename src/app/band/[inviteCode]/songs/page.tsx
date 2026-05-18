'use client'

import { useParams } from 'next/navigation'
import SongsTable from '@/components/SongsTable'
import BandHistoryPanel from '@/components/BandHistoryPanel'
import { useBand } from '@/contexts/BandContext'

export default function SongsPage() {
  const { inviteCode } = useParams() as { inviteCode: string }
  const { band, currentMember, isAdmin } = useBand()

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 dark:text-gray-100">Repertório</h2>
      <SongsTable
        inviteCode={inviteCode}
        currentMember={currentMember}
        allMembers={band.members}
        isAdmin={isAdmin}
        bandName={band.name}
      />
      <BandHistoryPanel inviteCode={inviteCode} type="song" title="Historico do repertorio" />
    </div>
  )
}
