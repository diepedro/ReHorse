'use client'

import { useParams } from 'next/navigation'
import SongsTable from '@/components/SongsTable'
import { useBand } from '@/contexts/BandContext'

export default function SongsPage() {
  const { inviteCode } = useParams() as { inviteCode: string }
  const { band, currentMember, isAdmin, readOnly } = useBand()

  return (
    <div>
      <div className="mb-4">
        <h2 className="party-title text-2xl">Repertorio</h2>
      </div>
      <SongsTable
        inviteCode={inviteCode}
        currentMember={currentMember}
        allMembers={band.members}
        isAdmin={isAdmin}
        bandName={band.name}
        readOnly={readOnly}
      />
    </div>
  )
}
