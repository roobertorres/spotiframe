/**
 * Multi-tier High-Resolution Cover Art Fallback Resolver
 *
 * Tier 1: iTunes Search API (with 3000x3000bb master rewrite)
 * Tier 2: Cover Art Archive via MusicBrainz Release Lookup
 * Tier 3: Spotify 640px cover art baseline
 */

export interface CoverResolutionResult {
  url: string
  source: 'itunes' | 'coverartarchive' | 'spotify' | 'placeholder'
}

export function rewriteItunesUrl(url: string, size: number = 3000): string {
  if (!url) return url
  // Rewrites any dimensions (e.g. 100x100bb, 600x600bb, 100x100-75) to target size
  return url.replace(/\/(\d+)x(\d+)[^/]*\.(jpg|jpeg|png|webp)/i, `/${size}x${size}bb.$3`)
}

function normalizeStr(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export async function fetchItunesCover(
  title: string,
  artist: string,
  timeoutMs: number = 2500
): Promise<string | null> {
  try {
    const term = `${title} ${artist}`
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=5`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Spotiframe/1.0' },
      signal: AbortSignal.timeout(timeoutMs)
    })

    if (!res.ok) return null
    const data = await res.json() as { results?: Array<{ collectionName: string; artistName: string; artworkUrl100?: string }> }
    if (!data.results || data.results.length === 0) return null

    const normTitle = normalizeStr(title)
    // Find matching collection to prevent false positives
    const match = data.results.find(r => {
      const normColl = normalizeStr(r.collectionName || '')
      return normColl.includes(normTitle) || normTitle.includes(normColl)
    })

    if (match && match.artworkUrl100) {
      return rewriteItunesUrl(match.artworkUrl100, 3000)
    }
  } catch {
    // Graceful fallback on network timeout or parse failure
  }
  return null
}

export async function fetchCoverArtArchive(
  title: string,
  artist: string,
  timeoutMs: number = 2500
): Promise<string | null> {
  try {
    const query = `release:"${title}" AND artist:"${artist}"`
    const mbUrl = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=3`
    const res = await fetch(mbUrl, {
      headers: {
        'User-Agent': 'Spotiframe/1.0 ( https://github.com/torres-labs/spotiframe )'
      },
      signal: AbortSignal.timeout(timeoutMs)
    })

    if (!res.ok) return null
    const data = await res.json() as { releases?: Array<{ id: string }> }
    if (!data.releases || data.releases.length === 0) return null

    for (const rel of data.releases) {
      const caaUrl = `https://coverartarchive.org/release/${rel.id}/front`
      try {
        const head = await fetch(caaUrl, {
          method: 'HEAD',
          redirect: 'manual',
          signal: AbortSignal.timeout(1500)
        })
        if (head.status === 200 || head.status === 307 || head.status === 302) {
          return caaUrl
        }
      } catch {
        // Probe next release candidate
      }
    }
  } catch {
    // Graceful fallback on MusicBrainz throttling
  }
  return null
}

export async function resolveHighResCover(
  title: string,
  artist: string,
  spotifyCoverUrl?: string,
  options?: { timeoutMs?: number }
): Promise<CoverResolutionResult> {
  const timeoutMs = options?.timeoutMs ?? 2500

  // Tier 1: iTunes 3000px rewrite
  const itunes = await fetchItunesCover(title, artist, timeoutMs)
  if (itunes) {
    return { url: itunes, source: 'itunes' }
  }

  // Tier 2: Cover Art Archive via MusicBrainz
  const caa = await fetchCoverArtArchive(title, artist, timeoutMs)
  if (caa) {
    return { url: caa, source: 'coverartarchive' }
  }

  // Tier 3: Spotify 640px cover art baseline
  if (spotifyCoverUrl && spotifyCoverUrl.trim().length > 0) {
    return { url: spotifyCoverUrl, source: 'spotify' }
  }

  return { url: '', source: 'placeholder' }
}
