'use client'

import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import {
  BASEMAP_STYLE,
  DATA_LAYERS,
  DOT_COLORS,
  MAP_ATTRIBUTION,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  TILE_SOURCE_LAYERS,
  type DataLayer,
  type GigaMapCountry,
  type MapTheme,
} from './config'

const DOTS_SOURCE = 'giga-entities'
const SCHOOL_LAYER = 'giga-schools-dots'
const HEALTH_LAYER = 'giga-health-dots'
const IDLE_TIMEOUT_MS = 45000

/* ------------------------------------------------------------------ */
/*  Country metadata (cached per session)                              */
/* ------------------------------------------------------------------ */

let countriesPromise: Promise<GigaMapCountry[]> | null = null

export function fetchGigaMapCountries(): Promise<GigaMapCountry[]> {
  if (!countriesPromise) {
    countriesPromise = fetch('/api/giga-maps/countries')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load country list (${res.status})`)
        return (await res.json()) as GigaMapCountry[]
      })
      .catch((err) => {
        countriesPromise = null
        throw err
      })
  }
  return countriesPromise
}

export async function getGigaMapCountry(code: string): Promise<GigaMapCountry> {
  const list = await fetchGigaMapCountries()
  const found = list.find((c) => c.code === code.toLowerCase())
  if (!found) throw new Error(`No Giga Maps data for country "${code.toUpperCase()}"`)
  return found
}

/* ------------------------------------------------------------------ */
/*  Map creation                                                       */
/* ------------------------------------------------------------------ */

export type GigaMapOptions = {
  container: HTMLElement
  country: GigaMapCountry
  theme: MapTheme
  layer: DataLayer
  pixelRatio?: number
  interactive?: boolean
}

function tileUrl(layer: DataLayer, countryId: number) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const kind = DATA_LAYERS[layer].entityCode
  return `${base}/api/giga-maps/tiles?kind=${kind}&country=${countryId}&z={z}&x={x}&y={y}`
}

const CONNECTIVITY_COLOR = [
  'match',
  ['get', 'connectivity_status'],
  'connected',
  DOT_COLORS.connected,
  'not_connected',
  DOT_COLORS.notConnected,
  DOT_COLORS.unknown,
]

const RADIUS_BY_ZOOM = ['interpolate', ['linear'], ['zoom'], 2, 1.4, 4, 2.2, 6, 3, 8, 4, 12, 6]
/* Health centers are drawn as squares. Circle layers cannot do that, so we
 * register one small square image per connectivity status and use a symbol
 * layer with collisions disabled. Images are 32px at pixelRatio 4 (8 CSS px)
 * so they stay crisp in the 2x export. */
const SQUARE_PX = 32
const SQUARE_IMAGE_RATIO = 4
const SQUARE_IMAGES: Record<'connected' | 'not_connected' | 'unknown', string> = {
  connected: 'giga-square-connected',
  not_connected: 'giga-square-not-connected',
  unknown: 'giga-square-unknown',
}
const SQUARE_COLORS: Record<keyof typeof SQUARE_IMAGES, string> = {
  connected: DOT_COLORS.connected,
  not_connected: DOT_COLORS.notConnected,
  unknown: DOT_COLORS.unknown,
}
// 8 CSS px image scaled by zoom: ~4px at z2, ~9px at z8, ~13px at z12.
const SQUARE_SIZE_BY_ZOOM = ['interpolate', ['linear'], ['zoom'], 2, 0.5, 4, 0.75, 6, 0.95, 8, 1.15, 12, 1.6]

function makeSquare(color: string): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = SQUARE_PX
  canvas.height = SQUARE_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, SQUARE_PX, SQUARE_PX)
  return ctx.getImageData(0, 0, SQUARE_PX, SQUARE_PX)
}

function ensureSquareImages(map: MapLibreMap) {
  for (const key of Object.keys(SQUARE_IMAGES) as (keyof typeof SQUARE_IMAGES)[]) {
    const id = SQUARE_IMAGES[key]
    if (!map.hasImage(id)) map.addImage(id, makeSquare(SQUARE_COLORS[key]), { pixelRatio: SQUARE_IMAGE_RATIO })
  }
}

function firstSymbolLayerId(map: MapLibreMap): string | undefined {
  const style = map.getStyle() as StyleSpecification | undefined
  return style?.layers.find((l) => l.type === 'symbol')?.id
}

/** Basemap source-layers that only add noise on a facility map. */
const HIDDEN_SOURCE_LAYERS = new Set(['transportation', 'transportation_name', 'aeroway', 'building'])

/**
 * The export is a clean shape map: no place names, no roads, and only
 * national borders (admin_level 2). Water, land use and coastlines stay.
 */
function cleanBasemap(map: MapLibreMap) {
  const style = map.getStyle() as StyleSpecification | undefined
  for (const l of style?.layers ?? []) {
    if (l.id.startsWith('giga-')) continue
    const sourceLayer = 'source-layer' in l ? l['source-layer'] : undefined
    const isInternalBoundary =
      sourceLayer === 'boundary' && !/country|boundary_2$|disputed/.test(l.id)
    if (l.type === 'symbol' || (sourceLayer && HIDDEN_SOURCE_LAYERS.has(sourceLayer)) || isInternalBoundary) {
      map.setLayoutProperty(l.id, 'visibility', 'none')
    }
  }
}

export function setGigaDataLayer(map: MapLibreMap, layer: DataLayer, countryId: number) {
  for (const id of [SCHOOL_LAYER, HEALTH_LAYER]) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  if (map.getSource(DOTS_SOURCE)) map.removeSource(DOTS_SOURCE)

  map.addSource(DOTS_SOURCE, {
    type: 'vector',
    tiles: [tileUrl(layer, countryId)],
    minzoom: 0,
    maxzoom: 14,
  })
  const before = firstSymbolLayerId(map)

  if (layer === 'school' || layer === 'all') {
    map.addLayer(
      {
        id: SCHOOL_LAYER,
        type: 'circle',
        source: DOTS_SOURCE,
        'source-layer': TILE_SOURCE_LAYERS.school,
        paint: {
          'circle-radius': RADIUS_BY_ZOOM as never,
          'circle-opacity': 0.9,
          'circle-color': CONNECTIVITY_COLOR as never,
        },
      },
      before
    )
  }
  if (layer === 'health' || layer === 'all') {
    ensureSquareImages(map)
    map.addLayer({
      id: HEALTH_LAYER,
      type: 'symbol',
      source: DOTS_SOURCE,
      'source-layer': TILE_SOURCE_LAYERS.health,
      layout: {
        'icon-image': [
          'match',
          ['get', 'connectivity_status'],
          'connected',
          SQUARE_IMAGES.connected,
          'not_connected',
          SQUARE_IMAGES.not_connected,
          SQUARE_IMAGES.unknown,
        ] as never,
        'icon-size': SQUARE_SIZE_BY_ZOOM as never,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: { 'icon-opacity': 0.95 },
    })
  }
}

/** Resolves when the map has finished loading tiles and rendering. */
export function waitForIdle(map: MapLibreMap, timeoutMs = IDLE_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      map.off('idle', onIdle)
      reject(new Error('Map render timed out'))
    }, timeoutMs)
    const onIdle = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve()
    }
    map.once('idle', onIdle)
    // Force a frame so 'idle' fires even if nothing was pending.
    map.triggerRepaint()
  })
}

export function createGigaMap(opts: GigaMapOptions): Promise<MapLibreMap> {
  const { container, country, theme, layer, pixelRatio = 1, interactive = false } = opts

  return new Promise((resolve, reject) => {
    let map: MapLibreMap
    try {
      // Note: MapLibre merges options over its defaults with Object.assign
      // semantics, so keys must be omitted (not set to undefined).
      const framing = country.bbox
        ? { bounds: country.bbox, fitBoundsOptions: { padding: 80 } }
        : { center: country.centroid ?? ([0, 0] as [number, number]), zoom: 4 }
      map = new maplibregl.Map({
        container,
        style: BASEMAP_STYLE[theme],
        ...framing,
        pixelRatio,
        interactive,
        attributionControl: false,
        canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
        fadeDuration: 0,
        maxTileCacheSize: 256,
      })
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Could not create map'))
      return
    }

    let styleErrored = false
    map.on('error', (e) => {
      // Tile 204s and missing sprites are harmless; a failed style is not.
      const msg = e?.error?.message ?? ''
      if (msg && !/tile|sprite|image/i.test(msg)) console.warn('[giga-map]', msg)
      if (!styleErrored && /style/i.test(msg)) {
        styleErrored = true
        reject(new Error(`Basemap failed to load: ${msg}`))
      }
    })

    if (process.env.NODE_ENV !== 'production') {
      ;(window as unknown as { __gigaMap?: MapLibreMap }).__gigaMap = map
    }

    map.once('load', () => {
      cleanBasemap(map)
      setGigaDataLayer(map, layer, country.id)
      resolve(map)
    })
  })
}

/* ------------------------------------------------------------------ */
/*  Export                                                             */
/* ------------------------------------------------------------------ */

export type ExportFormat = { type: 'image/png' } | { type: 'image/jpeg'; quality: number }

export async function exportGigaMapPng(
  map: MapLibreMap,
  scale: 1 | 2,
  format: ExportFormat = { type: 'image/png' }
): Promise<Blob> {
  const previousRatio = map.getPixelRatio()
  if (previousRatio !== scale) {
    map.setPixelRatio(scale)
    await waitForIdle(map)
  } else {
    await waitForIdle(map)
  }

  const src = map.getCanvas()
  const container = map.getContainer()
  const out = document.createElement('canvas')
  out.width = container.clientWidth * scale
  out.height = container.clientHeight * scale
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(src, 0, 0, out.width, out.height)

  // Attribution required by the OpenStreetMap licence. Small, bottom right.
  ctx.font = `${11 * scale}px "Open Sans", sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fillText(MAP_ATTRIBUTION, out.width - 14 * scale, out.height - 10 * scale)

  const blob = await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      format.type,
      format.type === 'image/jpeg' ? format.quality : undefined
    )
  })

  if (previousRatio !== scale) {
    map.setPixelRatio(previousRatio)
  }
  return blob
}

/**
 * One shot renderer: mounts an offscreen stage of the requested size,
 * renders, exports and cleans up. The size should match the slide slot the
 * image is going into, so the map is neither cropped nor letterboxed.
 */
export async function renderGigaMapBlob(opts: {
  countryCode: string
  theme: MapTheme
  layer: DataLayer
  width?: number
  height?: number
  scale?: 1 | 2
  format?: ExportFormat
}): Promise<Blob> {
  const width = opts.width ?? STAGE_WIDTH
  const height = opts.height ?? STAGE_HEIGHT
  const scale = opts.scale ?? 1
  const country = await getGigaMapCountry(opts.countryCode)
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-${width + 100}px;top:0;width:${width}px;height:${height}px;pointer-events:none;`
  document.body.appendChild(host)
  let map: MapLibreMap | null = null
  try {
    map = await createGigaMap({
      container: host,
      country,
      theme: opts.theme,
      layer: opts.layer,
      pixelRatio: scale,
    })
    return await exportGigaMapPng(map, scale, opts.format)
  } finally {
    map?.remove()
    host.remove()
  }
}

/**
 * Deck builder entry point: a JPEG data URL, the same shape and budget as an
 * uploaded photo (see readImageFile in components/SlideFrame.tsx), so it goes
 * through SET_IMAGE, survives the deck file's SAFE_ASSET check and inlines in
 * the HTML export without any extra work.
 */
export async function renderGigaMapDataUrl(opts: {
  countryCode: string
  theme: MapTheme
  layer: DataLayer
  width: number
  height: number
}): Promise<string> {
  const blob = await renderGigaMapBlob({ ...opts, scale: 1, format: { type: 'image/jpeg', quality: 0.85 } })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not encode the map'))
    reader.readAsDataURL(blob)
  })
}
