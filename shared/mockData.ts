/**
 * Shared Deterministic Mock Datasets and Offline Synthetic Engine
 */
import type { AlbumData, SearchResultItem, TrackItem } from './types'

// Format release date without timezone shift (e.g. "1999-06-08" -> "June 8, 1999")
export function formatReleaseDate(rawDate?: string | null): string {
  if (!rawDate) return ''
  const trimmed = String(rawDate).trim()
  if (!trimmed) return ''
  const parts = trimmed.split('-')
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const isYearValid = /^\d{4}$/.test(parts[0])

  if (parts.length === 3 && isYearValid) {
    const year = parts[0]
    const monthIdx = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day) && day >= 1 && day <= 31) {
      return `${MONTHS[monthIdx]} ${day}, ${year}`
    }
  } else if (parts.length === 2 && isYearValid) {
    const year = parts[0]
    const monthIdx = parseInt(parts[1], 10) - 1
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${MONTHS[monthIdx]} ${year}`
    }
  } else if (parts.length === 1 && isYearValid) {
    return parts[0]
  }
  return rawDate
}

// Format milliseconds into poster duration header (e.g. 4020000 -> "1h 7min", 3180000 -> "53min")
export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '0min'
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  if (hours > 0) {
    return `${hours}h ${mins}min`
  }
  return `${mins}min`
}

// Alias for formatDuration
export const formatTotalDuration = formatDuration

// Format track milliseconds into "m:ss" (e.g. 238000 -> "3:58")
export function formatTrackDuration(ms: number): string {
  if (!ms || ms <= 0) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Procedural Vector 23-Bar Spotify Scannables Generator
 * Produces an exact SVG identical in dimensions and structure to https://scannables.scdn.co
 * Uses <path> for background so the SVG has exactly 23 <rect> elements for the barcode bars.
 */
export function generateMockSpotifyCodeSvg(uri?: string | null, bg = 'ffffff', color = '000000'): string {
  const ALLOWED_HEIGHTS = [11, 18, 25, 32, 39, 46, 53, 60]
  let heights: number[] = []

  const safeUri = typeof uri === 'string' ? uri : ''
  const safeBg = typeof bg === 'string' && bg ? bg : 'ffffff'
  const safeColor = typeof color === 'string' && color ? color : '000000'

  const bgClean = safeBg.replace('#', '') || 'ffffff'
  const colorClean = safeColor.replace('#', '') || '000000'

  // Check for Californication canonical URI or ID
  const lowerUri = safeUri.toLowerCase()
  if (lowerUri.includes('4m2880jivsbbyegakfitca') || lowerUri.includes('0flhefnjliv34mrf8v8dco') || lowerUri.includes('californication')) {
    heights = [11, 32, 18, 11, 53, 25, 53, 32, 53, 53, 60, 60, 39, 39, 60, 46, 60, 53, 11, 60, 25, 32, 11]
  } else {
    // Deterministic procedural hash for any URI
    heights = [11] // First bar is always 11
    let hash = 0
    for (let j = 0; j < safeUri.length; j++) {
      hash = ((hash << 5) - hash) + safeUri.charCodeAt(j)
      hash |= 0
    }
    hash = Math.abs(hash)
    for (let i = 1; i <= 21; i++) {
      const idx = (hash >> (i % 24)) % ALLOWED_HEIGHTS.length
      heights.push(ALLOWED_HEIGHTS[Math.abs(idx) % ALLOWED_HEIGHTS.length])
      hash = (hash * 31 + i) | 0
    }
    heights.push(11) // Last bar is always 11
  }

  let barsSvg = ''
  for (let i = 0; i < 23; i++) {
    const x = 100.00 + i * 12.4223
    const h = heights[i]
    const y = 50.00 - h / 2
    barsSvg += `\n<rect class="bar" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="6.71" height="${h.toFixed(2)}" rx="3.36" ry="3.36" fill="#${colorClean}"/>`
  }

  const bgPath = bgClean === 'transparent' ? '' : `<path fill="#${bgClean}" d="M0 0h400v100H0z"/>`
  const logoPath = 'M31.1897 0.0240432C14.6347 -0.632948 0.681043 12.2549 0.024052 28.8097C-0.633075 45.3665 12.2553 59.319 28.8103 59.976C45.366 60.633 59.3188 47.7458 59.976 31.1893C60.633 14.6343 47.7453 0.681005 31.1897 0.0240432ZM43.8535 43.9722C43.4793 44.6292 42.7525 44.9595 42.0468 44.8602C41.829 44.8298 41.6135 44.7582 41.4105 44.6427C37.4455 42.3855 33.1242 40.9165 28.5667 40.276C24.0095 39.6355 19.4507 39.8565 15.0169 40.9335C14.0555 41.1667 13.0871 40.5768 12.8536 39.6155C12.6202 38.654 13.2103 37.6857 14.1715 37.452C19.0471 36.2682 24.058 36.0247 29.0655 36.7285C34.073 37.4322 38.8228 39.0475 43.1828 41.5293C44.0425 42.0187 44.3428 43.1125 43.8535 43.9722ZM47.7962 36.0967C47.1842 37.2277 45.771 37.6495 44.6403 37.037C39.9998 34.527 34.9767 32.879 29.7105 32.139C24.4443 31.3988 19.1614 31.5982 14.0087 32.732C13.7298 32.7935 13.4517 32.8022 13.1846 32.7647C12.2487 32.633 11.4492 31.9355 11.2343 30.9585C10.958 29.7025 11.752 28.4602 13.008 28.184C18.7039 26.9305 24.5416 26.7097 30.3585 27.5272C36.1758 28.3447 41.7262 30.1663 46.8558 32.941C47.987 33.5527 48.408 34.9657 47.7962 36.0967ZM52.1663 27.2192C51.5905 28.3263 50.3935 28.9 49.2245 28.7358C48.9105 28.6915 48.5987 28.5942 48.3012 28.4398C42.8988 25.6305 37.0798 23.7731 31.006 22.9195C24.9326 22.0659 18.8271 22.2474 12.8592 23.4587C11.3078 23.7732 9.79528 22.7712 9.48055 21.2201C9.16582 19.669 10.1679 18.1563 11.7191 17.8414C18.3266 16.5002 25.084 16.2991 31.8038 17.2435C38.5238 18.188 44.9642 20.2439 50.9457 23.3543C52.35 24.0846 52.8963 25.815 52.1663 27.2192Z'

  return `<svg width="640" height="160" viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
${bgPath}${barsSvg}
<g transform="translate(20,20)"><path fill="#${colorClean}" d="${logoPath}"/></g>
</svg>`
}

export const DEFAULT_COVER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="%23222222"/><text x="50%" y="50%" text-anchor="middle" fill="%23888888" font-family="sans-serif" font-size="28">No Cover Art</text></svg>'
export const PLACEHOLDER_COVER = DEFAULT_COVER

// 1. Canned Fixture: Californication (Matches Reference Poster Exactly)
export const MOCK_CALIFORNICATION: AlbumData = {
  id: 'mock-californication',
  title: 'Californication',
  artist: 'Red Hot Chili Peppers',
  releaseDate: 'June 8, 1999',
  rawReleaseDate: '1999-06-08',
  totalDuration: '1h 7min',
  totalDurationMs: 4020000, // 67 minutes exactly (sum of 15 track durations)
  totalTracks: 15,
  palette: ['#C1C0C3', '#607894', '#3E5976', '#1B334F', '#000000'],
  tracks: [
    { id: '1', name: 'Around the World', trackNumber: 1, durationMs: 238000, formattedDuration: '3:58' },
    { id: '2', name: 'Parallel Universe', trackNumber: 2, durationMs: 270000, formattedDuration: '4:30' },
    { id: '3', name: 'Scar Tissue', trackNumber: 3, durationMs: 217000, formattedDuration: '3:37' },
    { id: '4', name: 'Otherside', trackNumber: 4, durationMs: 255000, formattedDuration: '4:15' },
    { id: '5', name: 'Get on Top', trackNumber: 5, durationMs: 198000, formattedDuration: '3:18' },
    { id: '6', name: 'Californication', trackNumber: 6, durationMs: 321000, formattedDuration: '5:21' },
    { id: '7', name: 'Easily', trackNumber: 7, durationMs: 231000, formattedDuration: '3:51' },
    { id: '8', name: 'Porcelain', trackNumber: 8, durationMs: 163000, formattedDuration: '2:43' },
    { id: '9', name: 'Emit Remmus', trackNumber: 9, durationMs: 240000, formattedDuration: '4:00' },
    { id: '10', name: 'I Like Dirt', trackNumber: 10, durationMs: 157000, formattedDuration: '2:37' },
    { id: '11', name: 'This Velvet Glove', trackNumber: 11, durationMs: 225000, formattedDuration: '3:45' },
    { id: '12', name: 'Savior', trackNumber: 12, durationMs: 292000, formattedDuration: '4:52' },
    { id: '13', name: 'Purple Stain', trackNumber: 13, durationMs: 253000, formattedDuration: '4:13' },
    { id: '14', name: 'Right on Time', trackNumber: 14, durationMs: 112000, formattedDuration: '1:52' },
    { id: '15', name: "Road Trippin'", trackNumber: 15, durationMs: 848000, formattedDuration: '14:08' }
  ],
  coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/78/2f/5d/782f5d1d-c67a-7798-a551-03a254bf419c/f1d71bc1-8ea3-4129-baa8-36770b87d0c7.jpg/3000x3000bb.jpg',
  coverSource: 'itunes',
  spotifyUri: 'spotify:album:0fLhefnjlIV34MrF8v8dcO',
  spotifyCodeSvg: generateMockSpotifyCodeSvg('spotify:album:0fLhefnjlIV34MrF8v8dcO'),
  isMock: true
}

export const CALIFORNICATION_ALBUM = MOCK_CALIFORNICATION

// 2. Canned Fixture: OK Computer
export const MOCK_OK_COMPUTER: AlbumData = {
  id: 'mock-ok-computer',
  title: 'OK Computer',
  artist: 'Radiohead',
  releaseDate: 'May 21, 1997',
  rawReleaseDate: '1997-05-21',
  totalDuration: '53min',
  totalDurationMs: 3180000, // 53 minutes exactly
  totalTracks: 12,
  palette: ['#E2EDF6', '#9EB8CF', '#5C80A4', '#2D4B68', '#111E2B'],
  tracks: [
    { id: 't1', name: 'Airbag', trackNumber: 1, durationMs: 284000, formattedDuration: '4:44' },
    { id: 't2', name: 'Paranoid Android', trackNumber: 2, durationMs: 383000, formattedDuration: '6:23' },
    { id: 't3', name: 'Subterranean Homesick Alien', trackNumber: 3, durationMs: 267000, formattedDuration: '4:27' },
    { id: 't4', name: 'Exit Music (For a Film)', trackNumber: 4, durationMs: 264000, formattedDuration: '4:24' },
    { id: 't5', name: 'Let Down', trackNumber: 5, durationMs: 299000, formattedDuration: '4:59' },
    { id: 't6', name: 'Karma Police', trackNumber: 6, durationMs: 261000, formattedDuration: '4:21' },
    { id: 't7', name: 'Fitter Happier', trackNumber: 7, durationMs: 117000, formattedDuration: '1:57' },
    { id: 't8', name: 'Electioneering', trackNumber: 8, durationMs: 230000, formattedDuration: '3:50' },
    { id: 't9', name: 'Climbing Up the Walls', trackNumber: 9, durationMs: 285000, formattedDuration: '4:45' },
    { id: 't10', name: 'No Surprises', trackNumber: 10, durationMs: 228000, formattedDuration: '3:48' },
    { id: 't11', name: 'Lucky', trackNumber: 11, durationMs: 259000, formattedDuration: '4:19' },
    { id: 't12', name: 'The Tourist', trackNumber: 12, durationMs: 303000, formattedDuration: '5:03' }
  ],
  coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4e/c9/7e/4ec97e68-0797-e85e-b153-61fa6ce4ef29/00634904078121.rgb.jpg/3000x3000bb.jpg',
  coverSource: 'itunes',
  spotifyUri: 'spotify:album:6dVIqQ8qmQ5GBnJ9shOYGE',
  spotifyCodeSvg: generateMockSpotifyCodeSvg('spotify:album:6dVIqQ8qmQ5GBnJ9shOYGE'),
  isMock: true
}

export const OK_COMPUTER_ALBUM = MOCK_OK_COMPUTER

// 3. Canned Fixture: Abbey Road
export const MOCK_ABBEY_ROAD: AlbumData = {
  id: 'mock-abbey-road',
  title: 'Abbey Road',
  artist: 'The Beatles',
  releaseDate: 'September 26, 1969',
  rawReleaseDate: '1969-09-26',
  totalDuration: '47min',
  totalDurationMs: 2840000, // 47 minutes (sum of 17 track durations: 2840000 ms)
  totalTracks: 17,
  palette: ['#DCE3EA', '#7C93A4', '#455964', '#2C3A3F', '#111516'],
  tracks: [
    { id: 't1', name: 'Come Together', trackNumber: 1, durationMs: 260000, formattedDuration: '4:20' },
    { id: 't2', name: 'Something', trackNumber: 2, durationMs: 183000, formattedDuration: '3:03' },
    { id: 't3', name: "Maxwell's Silver Hammer", trackNumber: 3, durationMs: 207000, formattedDuration: '3:27' },
    { id: 't4', name: 'Oh! Darling', trackNumber: 4, durationMs: 206000, formattedDuration: '3:26' },
    { id: 't5', name: "Octopus's Garden", trackNumber: 5, durationMs: 171000, formattedDuration: '2:51' },
    { id: 't6', name: "I Want You (She's So Heavy)", trackNumber: 6, durationMs: 467000, formattedDuration: '7:47' },
    { id: 't7', name: 'Here Comes the Sun', trackNumber: 7, durationMs: 185000, formattedDuration: '3:05' },
    { id: 't8', name: 'Because', trackNumber: 8, durationMs: 165000, formattedDuration: '2:45' },
    { id: 't9', name: 'You Never Give Me Your Money', trackNumber: 9, durationMs: 242000, formattedDuration: '4:02' },
    { id: 't10', name: 'Sun King', trackNumber: 10, durationMs: 146000, formattedDuration: '2:26' },
    { id: 't11', name: 'Mean Mr. Mustard', trackNumber: 11, durationMs: 66000, formattedDuration: '1:06' },
    { id: 't12', name: 'Polythene Pam', trackNumber: 12, durationMs: 72000, formattedDuration: '1:12' },
    { id: 't13', name: 'She Came In Through the Bathroom Window', trackNumber: 13, durationMs: 117000, formattedDuration: '1:57' },
    { id: 't14', name: 'Golden Slumbers', trackNumber: 14, durationMs: 91000, formattedDuration: '1:31' },
    { id: 't15', name: 'Carry That Weight', trackNumber: 15, durationMs: 96000, formattedDuration: '1:36' },
    { id: 't16', name: 'The End', trackNumber: 16, durationMs: 139000, formattedDuration: '2:19' },
    { id: 't17', name: 'Her Majesty', trackNumber: 17, durationMs: 27000, formattedDuration: '0:27' }
  ],
  coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4e/c9/7e/4ec97e68-0797-e85e-b153-61fa6ce4ef29/00602508007446.rgb.jpg/3000x3000bb.jpg',
  coverSource: 'itunes',
  spotifyUri: 'spotify:album:0ETFjACtuP2ADo6LFhL6HN',
  spotifyCodeSvg: generateMockSpotifyCodeSvg('spotify:album:0ETFjACtuP2ADo6LFhL6HN'),
  isMock: true
}

export const ABBEY_ROAD_ALBUM = MOCK_ABBEY_ROAD

// 4. Canned Fixture: Random Access Memories
export const MOCK_RANDOM_ACCESS_MEMORIES: AlbumData = {
  id: 'mock-random-access-memories',
  title: 'Random Access Memories',
  artist: 'Daft Punk',
  releaseDate: 'May 17, 2013',
  rawReleaseDate: '2013-05-17',
  totalDuration: '1h 14min',
  totalDurationMs: 4464000, // 74 minutes (sum of 13 track durations: 4464000 ms)
  totalTracks: 13,
  palette: ['#E6E6E6', '#9B9B9B', '#4A4A4A', '#1C1C1C', '#0A0A0A'],
  tracks: [
    { id: 't1', name: 'Give Life Back to Music', trackNumber: 1, durationMs: 274000, formattedDuration: '4:34' },
    { id: 't2', name: 'The Game of Love', trackNumber: 2, durationMs: 321000, formattedDuration: '5:21' },
    { id: 't3', name: 'Giorgio by Moroder', trackNumber: 3, durationMs: 544000, formattedDuration: '9:04' },
    { id: 't4', name: 'Within', trackNumber: 4, durationMs: 228000, formattedDuration: '3:48' },
    { id: 't5', name: 'Instant Crush', trackNumber: 5, durationMs: 337000, formattedDuration: '5:37' },
    { id: 't6', name: 'Lose Yourself to Dance', trackNumber: 6, durationMs: 353000, formattedDuration: '5:53' },
    { id: 't7', name: 'Touch', trackNumber: 7, durationMs: 498000, formattedDuration: '8:18' },
    { id: 't8', name: 'Get Lucky', trackNumber: 8, durationMs: 367000, formattedDuration: '6:07' },
    { id: 't9', name: 'Beyond', trackNumber: 9, durationMs: 290000, formattedDuration: '4:50' },
    { id: 't10', name: 'Motherboard', trackNumber: 10, durationMs: 341000, formattedDuration: '5:41' },
    { id: 't11', name: 'Fragments of Time', trackNumber: 11, durationMs: 279000, formattedDuration: '4:39' },
    { id: 't12', name: "Doin' It Right", trackNumber: 12, durationMs: 251000, formattedDuration: '4:11' },
    { id: 't13', name: 'Contact', trackNumber: 13, durationMs: 381000, formattedDuration: '6:21' }
  ],
  coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/bf/25/7f/bf257fe5-5b41-118e-4a6c-f2f2e519c96d/886443912198.jpg/3000x3000bb.jpg',
  coverSource: 'itunes',
  spotifyUri: 'spotify:album:4m2880jivSbbyEGAKfITCa',
  spotifyCodeSvg: generateMockSpotifyCodeSvg('spotify:album:4m2880jivSbbyEGAKfITCa'),
  isMock: true
}

export const RANDOM_ACCESS_MEMORIES_ALBUM = MOCK_RANDOM_ACCESS_MEMORIES

export const CANNED_ALBUMS: AlbumData[] = [
  MOCK_CALIFORNICATION,
  MOCK_OK_COMPUTER,
  MOCK_ABBEY_ROAD,
  MOCK_RANDOM_ACCESS_MEMORIES
]

export const MOCK_ALBUMS = CANNED_ALBUMS

export const MOCK_SEARCH_RESULTS: SearchResultItem[] = CANNED_ALBUMS.map(a => ({
  id: a.id,
  name: a.title,
  artist: a.artist,
  releaseDate: a.releaseDate,
  coverUrl: a.coverUrl,
  totalTracks: a.totalTracks,
  spotifyUri: a.spotifyUri
}))

// String Hash Helper
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// Safely truncate string by Unicode code points without splitting surrogate pairs,
// and encode for SVG data URI
function safeSliceAndEncode(str: string, maxLen = 30): string {
  const codePoints = Array.from(str || '').slice(0, maxLen).join('')
  const wellFormed = typeof codePoints.toWellFormed === 'function'
    ? codePoints.toWellFormed()
    : codePoints.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
  return encodeURIComponent(wellFormed)
}

/**
 * Dynamic Query Synthesizer
 * Synthesizes realistic AlbumData for ANY arbitrary search string or boundary offline
 */
export function synthesizeMockAlbum(query: string): AlbumData {
  const clean = (query || '').trim()
  let title = clean || 'Unknown Album'
  let artist = 'Featured Artist'

  if (clean.includes(' - ')) {
    const parts = clean.split(' - ')
    artist = parts[0].trim()
    title = parts.slice(1).join(' - ').trim()
  } else if (clean.toLowerCase().includes(' by ')) {
    const parts = clean.split(/ by /i)
    title = parts[0].trim()
    artist = parts[1].trim()
  }

  const lower = clean.toLowerCase()
  const hash = hashString(clean || 'spotiframe_seed')

  let trackCount = 8 + (hash % 7) // 8 to 14 tracks default
  if (lower.includes('deluxe') || lower.includes('40_tracks')) {
    trackCount = 42
  } else if (lower.includes('single_track') || lower.includes('single')) {
    trackCount = 1
  }

  let releaseDate = ''
  let rawReleaseDate = ''
  if (lower.includes('missing_metadata')) {
    releaseDate = 'Unknown Date'
    rawReleaseDate = ''
  } else {
    const year = 1970 + (hash % 55) // 1970 to 2024
    const monthIdx = (hash >> 3) % 12
    const day = 1 + ((hash >> 5) % 28)
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    releaseDate = `${MONTHS[monthIdx]} ${day}, ${year}`
    rawReleaseDate = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const tracks: TrackItem[] = []
  let totalMs = 0
  for (let i = 1; i <= trackCount; i++) {
    const durMs = trackCount === 1 ? 210000 : (180000 + ((hash * i * 37) % 150000))
    totalMs += durMs
    tracks.push({
      id: `syn-t${i}`,
      name: trackCount === 1 ? title : i === 1 ? `${title} (Intro)` : i === trackCount ? 'Outro / Finale' : `Track ${i} - ${title} Part ${i}`,
      trackNumber: i,
      durationMs: durMs,
      formattedDuration: formatTrackDuration(durMs)
    })
  }

  const hue1 = hash % 360
  const hue2 = (hue1 + 40) % 360
  // Clean offline SVG cover
  const svgCover = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="hsl(${hue1},60%,35%)"/><stop offset="100%" stop-color="hsl(${hue2},70%,15%)"/></linearGradient></defs><rect width="600" height="600" fill="url(%23g)"/><text x="50%" y="45%" text-anchor="middle" fill="%23ffffff" font-family="sans-serif" font-size="32" font-weight="bold">${safeSliceAndEncode(title, 30)}</text><text x="50%" y="55%" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="sans-serif" font-size="20">${safeSliceAndEncode(artist, 30)}</text></svg>`

  const id = `mock-syn-${hash.toString(36)}`
  const spotifyUri = `spotify:album:${hash.toString(36)}`

  return {
    id,
    title,
    artist,
    releaseDate,
    rawReleaseDate,
    totalDuration: lower.includes('missing_metadata') ? 'Unknown Duration' : formatDuration(totalMs),
    totalDurationMs: totalMs,
    totalTracks: trackCount,
    tracks,
    coverUrl: svgCover,
    coverSource: 'mock',
    spotifyUri,
    spotifyCodeSvg: generateMockSpotifyCodeSvg(spotifyUri),
    palette: ['#E6E6FA', '#9370DB', '#4B0082', '#2E0854', '#000000'],
    isMock: true
  }
}

/**
 * Search mock database with query matching and dynamic fallback
 */
export function searchMockAlbums(query: string): SearchResultItem[] {
  const q = (query || '').toLowerCase().trim()
  if (!q) {
    return []
  }

  // 1. Search canned fixtures
  const matches = CANNED_ALBUMS.filter(a =>
    a.title.toLowerCase().includes(q) ||
    a.artist.toLowerCase().includes(q) ||
    a.id.toLowerCase().includes(q)
  )

  if (matches.length > 0) {
    return matches.map(a => ({
      id: a.id,
      name: a.title,
      artist: a.artist,
      releaseDate: a.releaseDate,
      coverUrl: a.coverUrl,
      totalTracks: a.totalTracks,
      spotifyUri: a.spotifyUri
    }))
  }

  // 2. Dynamic synthesizer fallback
  const synthesized = synthesizeMockAlbum(query)
  return [{
    id: synthesized.id,
    name: synthesized.title,
    artist: synthesized.artist,
    releaseDate: synthesized.releaseDate,
    coverUrl: synthesized.coverUrl,
    totalTracks: synthesized.totalTracks,
    spotifyUri: synthesized.spotifyUri
  }]
}

/**
 * Look up album by exact ID or query string
 */
export function getMockAlbumById(id: string): AlbumData | undefined {
  if (!id) return undefined
  const cleanId = id.toLowerCase().trim()
  const rawId = cleanId.replace(/^mock-/, '')

  // Exact ID / hash matches
  if (
    cleanId === 'californication' ||
    cleanId === 'mock-californication' ||
    cleanId === '0flhefnjliv34mrf8v8dco' ||
    cleanId === '4m2880jivsbbyegakfitca' ||
    rawId === 'californication'
  ) {
    return MOCK_CALIFORNICATION
  }

  if (
    cleanId === 'ok-computer' ||
    cleanId === 'mock-ok-computer' ||
    cleanId === '6dviqq8qmq5gbnj9shoyge' ||
    rawId === 'ok-computer'
  ) {
    return MOCK_OK_COMPUTER
  }

  if (
    cleanId === 'abbey-road' ||
    cleanId === 'mock-abbey-road' ||
    cleanId === '0etfjactup2ado6lfhl6hn' ||
    rawId === 'abbey-road'
  ) {
    return MOCK_ABBEY_ROAD
  }

  if (
    cleanId === 'random-access-memories' ||
    cleanId === 'mock-random-access-memories' ||
    cleanId === '2norn2kdflra2ontjiqkvr' ||
    rawId === 'random-access-memories'
  ) {
    return MOCK_RANDOM_ACCESS_MEMORIES
  }

  // Search in CANNED_ALBUMS
  const found = CANNED_ALBUMS.find(a =>
    a.id.toLowerCase() === cleanId ||
    a.id.toLowerCase().replace(/^mock-/, '') === rawId ||
    a.spotifyUri.toLowerCase().includes(cleanId) ||
    a.title.toLowerCase() === cleanId
  )

  if (found) return found

  // Synthesize boundary or dynamic album
  return synthesizeMockAlbum(id)
}

export function getMockAlbumByQuery(query: string): AlbumData {
  const found = getMockAlbumById(query)
  if (found) return found
  return synthesizeMockAlbum(query)
}

export default {
  californication: MOCK_CALIFORNICATION,
  okComputer: MOCK_OK_COMPUTER,
  abbeyRoad: MOCK_ABBEY_ROAD,
  randomAccessMemories: MOCK_RANDOM_ACCESS_MEMORIES,
  cannedAlbums: CANNED_ALBUMS,
  mockAlbums: MOCK_ALBUMS,
  searchResults: MOCK_SEARCH_RESULTS,
  defaultCover: DEFAULT_COVER
}
