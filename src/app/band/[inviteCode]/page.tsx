import { redirect } from 'next/navigation'

export default function BandIndexPage({ params }: { params: { inviteCode: string } }) {
  redirect(`/band/${params.inviteCode}/rehearsals`)
}
