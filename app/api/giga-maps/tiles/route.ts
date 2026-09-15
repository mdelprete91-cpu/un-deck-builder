import { NextRequest, NextResponse } from 'next/server'
import { GIGA_BACKEND } from '@/lib/giga-maps/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Vector tile proxy for facility dots. The Giga backend serves the tiles
 * publicly but without CORS headers, so the browser cannot fetch them
 * directly from gigabrand. We forward the request and let Vercel's CDN cache
 * the response (tiles change at most every few hours upstream).
 *
 * kind=school | health | all -> /api/v2/entities/tiles/connectivity_status/
 * Schools arrive in source-layer "school", health centers in "entities".
 */

const TILE_HEADERS = {
  'Content-Type': 'application/vnd.mapbox-vector-tile',
  'Cache-Control': 'public, max-age=3600, s-maxage=14400, stale-while-revalidate=86400',
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const kindParam = sp.get('kind')
  const kind = kindParam === 'health' || kindParam === 'all' ? kindParam : 'school'
  const countryId = Number(sp.get('country'))
  const z = Number(sp.get('z'))
  const x = Number(sp.get('x'))
  const y = Number(sp.get('y'))

  if (![countryId, z, x, y].every((n) => Number.isInteger(n) && n >= 0)) {
    return NextResponse.json({ error: 'Invalid tile parameters' }, { status: 400 })
  }
  if (z > 16) return new NextResponse(null, { status: 204 })

  const upstream =
    `${GIGA_BACKEND}/api/v2/entities/tiles/connectivity_status/` +
    `?country_id=${countryId}&entity_type__code=${kind}&z=${z}&x=${x}&y=${y}.mvt`

  try {
    // No Accept header on purpose: the backend answers 406 to anything
    // narrower than */*.
    const res = await fetch(upstream, {
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    })
    if (res.status === 404 || res.status === 204) {
      return new NextResponse(null, { status: 204, headers: TILE_HEADERS })
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 })
    }
    const buf = await res.arrayBuffer()
    if (buf.byteLength === 0) {
      return new NextResponse(null, { status: 204, headers: TILE_HEADERS })
    }
    return new NextResponse(buf, { status: 200, headers: TILE_HEADERS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Tile fetch failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
