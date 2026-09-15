import { NextResponse } from 'next/server'
import { GIGA_BACKEND, type GigaMapCountry } from '@/lib/giga-maps/config'

export const revalidate = 86400

type BackendCountry = {
  id: number
  name: string
  code: string
  entity_counts?: { school?: number; health?: number } | null
  admin_metadata?: {
    bbox?: number[] | null
    centroid?: number[] | null
  } | null
}

/**
 * Country list for the Maps page picker. Proxies the public Giga Maps backend
 * and keeps only what the renderer needs: id (for tiles), bbox (for framing)
 * and facility counts (schools, health centers) for the UI.
 */
export async function GET() {
  try {
    const res = await fetch(`${GIGA_BACKEND}/api/v2/entities/countries/`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Giga backend responded ${res.status}` },
        { status: 502 }
      )
    }
    const raw = (await res.json()) as BackendCountry[] | { results: BackendCountry[] }
    const list = Array.isArray(raw) ? raw : raw.results

    const countries: GigaMapCountry[] = list
      .filter((c) => c.code && c.admin_metadata?.bbox?.length === 4)
      .map((c) => ({
        code: c.code.toLowerCase(),
        name: c.name,
        id: c.id,
        bbox: c.admin_metadata!.bbox as [number, number, number, number],
        centroid:
          c.admin_metadata?.centroid?.length === 2
            ? (c.admin_metadata.centroid as [number, number])
            : null,
        schoolsTotal: c.entity_counts?.school ?? 0,
        healthTotal: c.entity_counts?.health ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json(countries, {
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
