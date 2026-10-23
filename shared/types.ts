/**
 * Shared TypeScript Data Contracts for Spotiframe
 */

export interface TrackItem {
  id: string
  name: string
  trackNumber: number
  durationMs: number
  formattedDuration?: string // e.g. "3:58"
}

// Alias for moduleResolver / E2E helpers
export type AlbumTrack = TrackItem

export type CoverSource =
  | 'spotify'
  | 'itunes'
  | 'coverartarchive'
  | 'musicbrainz'
  | 'placeholder'
  | 'custom'
  | 'mock'

export interface AlbumData {
  id: string
  title: string
  artist: string
  releaseDate: string // e.g. "June 8, 1999"
  rawReleaseDate?: string // e.g. "1999-06-08"
  totalDuration: string // e.g. "1h 7min"
  totalDurationMs?: number // raw total milliseconds
  totalTracks: number
  tracks: TrackItem[]
  coverUrl: string // High-resolution cover art (iTunes 3000px, CAA, or fallback)
  coverSource?: CoverSource
  spotifyUri: string // e.g. "spotify:album:4m2880jivSbbyEGAKfITCa"
  spotifyCodeSvg?: string // Vector SVG scannable soundcode
  palette?: string[] // 5 hex colors ordered light to dark
  isMock?: boolean
}

export interface SearchResultItem {
  id: string
  name: string
  artist: string
  releaseDate: string
  coverUrl: string
  totalTracks: number
  spotifyUri?: string
}

// Alias for moduleResolver / E2E helpers
export type AlbumSearchResult = SearchResultItem

export interface SearchResult {
  results: SearchResultItem[]
  isMock?: boolean
}

export interface CoverFallbackResult {
  url: string
  source: CoverSource
  width?: number
  height?: number
}

export interface PosterState {
  title: string
  artist: string
  releaseDate: string
  totalDuration: string
  tracks: string[] // List of track names for 2-column rendering
  coverUrl: string
  palette: string[] // 5 hex colors ordered light to dark
  spotifyUri: string
  spotifyCodeSvg: string
}

export interface ExportPdfOptions {
  format: 'a3' | 'a2'
}

export interface ExportPngOptions {
  format: 'a3' | 'a2'
  dpi?: number // default 300
}

// Spotify Raw API Shapes
export interface SpotifyImage {
  url: string
  height: number | null
  width: number | null
}

export interface SpotifySimplifiedArtist {
  id: string
  name: string
  uri: string
}

export interface SpotifySimplifiedTrack {
  id: string
  name: string
  track_number: number
  duration_ms: number
  uri: string
}

export interface SpotifyAlbumResponse {
  id: string
  name: string
  artists: SpotifySimplifiedArtist[]
  release_date: string
  release_date_precision: 'year' | 'month' | 'day'
  total_tracks: number
  images: SpotifyImage[]
  tracks: {
    items: SpotifySimplifiedTrack[]
    total: number
  }
  uri: string
}

export interface SpotifySearchResponse {
  albums?: {
    items: Array<{
      id: string
      name: string
      artists: SpotifySimplifiedArtist[]
      release_date: string
      images: SpotifyImage[]
      total_tracks: number
      uri: string
    }>
    total: number
  }
}
