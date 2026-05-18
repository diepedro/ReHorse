import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q) return NextResponse.json([])

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=15`
  const res = await fetch(url)
  if (!res.ok) return NextResponse.json([])

  const data = await res.json()
  const results = (data.results ?? []).map((t: {
    trackId: number
    trackName: string
    artistName: string
    artworkUrl100: string
    previewUrl: string | null
    trackViewUrl: string
    trackTimeMillis: number | null
  }) => ({
    id: String(t.trackId),
    trackName: t.trackName,
    artistName: t.artistName,
    artworkUrl: t.artworkUrl100?.replace('100x100bb', '300x300bb') ?? '',
    previewUrl: t.previewUrl ?? null,
    externalUrl: t.trackViewUrl,
    source: 'itunes' as const,
    durationMs: t.trackTimeMillis ?? null,
  }))

  return NextResponse.json(results)
}
