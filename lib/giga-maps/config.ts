/**
 * Shared configuration for the client side Giga Maps renderer.
 *
 * School dots come from the public Giga Maps backend as Mapbox Vector Tiles.
 * The basemap is OpenFreeMap (OpenMapTiles + OpenStreetMap data), which needs
 * no API key. Both are proxied / referenced from here so the map component,
 * the export helper and the API routes agree on one source of truth.
 */

export const GIGA_BACKEND = 'https://uni-ooi-giga-backend-hjekcuagasashucv.a03.azurefd.net'

export type DataLayer = 'school' | 'health' | 'all'
export type MapTheme = 'dark' | 'light'

export const STAGE_WIDTH = 1920
export const STAGE_HEIGHT = 1080

export const BASEMAP_STYLE: Record<MapTheme, string> = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
}

/** Legend colors as used on maps.giga.global. */
export const DOT_COLORS = {
  connected: '#00d661',
  notConnected: '#ed5b4c',
  unknown: '#1d8cf0',
  good: '#00d661',
  moderate: '#f6c344',
  bad: '#ff5538',
} as const

/** Legend shared by every facility type. */
export const CONNECTIVITY_LEGEND = [
  { label: 'Connected', color: DOT_COLORS.connected },
  { label: 'Not connected', color: DOT_COLORS.notConnected },
  { label: 'Unknown', color: DOT_COLORS.unknown },
]

export const DATA_LAYERS: Record<
  DataLayer,
  { label: string; fileTag: string; entityCode: 'school' | 'health' | 'all' }
> = {
  school: { label: 'Schools', fileTag: 'schools', entityCode: 'school' },
  health: { label: 'Health centers', fileTag: 'health', entityCode: 'health' },
  all: { label: 'All facilities', fileTag: 'all-facilities', entityCode: 'all' },
}

/** Vector tile source-layer names inside the Giga v2 entity tiles. */
export const TILE_SOURCE_LAYERS = {
  school: 'school',
  health: 'entities',
} as const

export const MAP_ATTRIBUTION = '© OpenMapTiles © OpenStreetMap contributors · Facility data: Giga'

export type GigaMapCountry = {
  code: string
  name: string
  id: number
  bbox: [number, number, number, number] | null
  centroid: [number, number] | null
  schoolsTotal: number
  healthTotal: number
}
