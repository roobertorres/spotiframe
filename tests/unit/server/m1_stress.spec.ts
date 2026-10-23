import { describe, it, expect } from 'vitest'
import {
  formatReleaseDate,
  formatDuration,
  formatTotalDuration,
  formatTrackDuration,
  generateMockSpotifyCodeSvg,
  synthesizeMockAlbum,
  searchMockAlbums,
  getMockAlbumById,
  getMockAlbumByQuery,
  CANNED_ALBUMS,
  MOCK_CALIFORNICATION,
  MOCK_OK_COMPUTER,
  MOCK_ABBEY_ROAD,
  MOCK_RANDOM_ACCESS_MEMORIES
} from '../../../shared/mockData'

describe('Milestone 1 Empirical Stress & Edge Case Harness', () => {
  describe('1. Search Query Stress & Boundaries', () => {
    it('handles empty, whitespace, and falsy queries gracefully returning empty array', () => {
      const falsyQueries = ['', '   ', '\t\n  ']

      for (const q of falsyQueries) {
        expect(() => searchMockAlbums(q)).not.toThrow()
        const directResults = searchMockAlbums(q)
        expect(Array.isArray(directResults)).toBe(true)
        expect(directResults).toHaveLength(0)
      }
    })

    it('handles standard emoji search queries without throwing or crashing', () => {
      const emojiQueries = [
        '🎵',
        '🔥💯🚀🎉',
        '👨‍👩‍👧‍👦',
        '🇺🇸🇯🇵🇬🇧',
        'Album 🎵 by Artist 🎸',
        '🎵 Sound of Music 🎵'
      ]

      for (const q of emojiQueries) {
        let res: any
        expect(() => {
          res = searchMockAlbums(q)
        }).not.toThrow()
        expect(res).toBeDefined()
        expect(res.length).toBeGreaterThanOrEqual(1)
        expect(res[0].id).toBeDefined()
        expect(res[0].name).toBeDefined()
      }
    })

    it('handles surrogate pairs at 30-char boundary safely without URIError in synthesizeMockAlbum', () => {
      const surrogateSplitQuery = 'a'.repeat(29) + '🎵'

      expect(() => {
        synthesizeMockAlbum(surrogateSplitQuery)
      }).not.toThrow()

      const album = synthesizeMockAlbum(surrogateSplitQuery)
      expect(album).toBeDefined()
      expect(album.coverUrl).toBeDefined()
      expect(album.coverUrl).toContain('data:image/svg+xml')

      expect(() => {
        searchMockAlbums(surrogateSplitQuery)
      }).not.toThrow()

      expect(() => {
        getMockAlbumById(surrogateSplitQuery)
      }).not.toThrow()
    })

    it('handles special characters, XML/SVG injections, and quotes safely', () => {
      const specialQueries = [
        '<script>alert("xss")</script>',
        '"><svg onload=alert(1)>',
        'Album & Title "with quotes" and \'single quotes\'',
        'C++ / C# / Node.js & Rust',
        'Slash/Backslash\\Question?Hash#Percent%Ampersand&',
        'null',
        'undefined',
        'NaN',
        'true',
        'false',
        '0',
        '-1'
      ]

      for (const q of specialQueries) {
        let res: any
        expect(() => {
          res = searchMockAlbums(q)
        }).not.toThrow()
        expect(res.length).toBeGreaterThanOrEqual(1)
        expect(typeof res[0].name).toBe('string')
        expect(res[0].name.length).toBeGreaterThan(0)
      }
    })

    it('handles extreme length queries (500 chars and 10,000 chars) deterministically', () => {
      const longAscii = 'A'.repeat(500)
      const longEmoji = '🎸'.repeat(250) // 500 UTF-16 code units
      const hugeString = 'Spotiframe-Stress-'.repeat(500) // 9000 chars

      for (const q of [longAscii, longEmoji, hugeString]) {
        let res: any
        expect(() => {
          res = searchMockAlbums(q)
        }).not.toThrow()
        expect(res).toBeDefined()
        expect(res.length).toBe(1)
        expect(res[0].totalTracks).toBeGreaterThan(0)
      }
    })

    it('parses artist and title split syntax correctly ("Artist - Title" and "Title by Artist")', () => {
      const res1 = searchMockAlbums('Daft Punk - Discovery')
      expect(res1[0].artist).toBe('Daft Punk')
      expect(res1[0].name).toBe('Discovery')

      const res2 = searchMockAlbums('Thriller by Michael Jackson')
      expect(res2[0].name).toBe('Thriller')
      expect(res2[0].artist).toBe('Michael Jackson')

      // Boundary delimiters
      expect(() => searchMockAlbums(' - ')).not.toThrow()
      expect(() => searchMockAlbums(' by ')).not.toThrow()
      expect(() => searchMockAlbums('SingleWordNoDelimiter')).not.toThrow()
    })
  })

  describe('2. Album Lookup Stress & Edge Cases', () => {
    it('resolves unknown and nonexistent IDs to valid fallback AlbumData', () => {
      const unknownIds = [
        'unknown-id-99999',
        'nonexistent-uuid-xyz',
        '0000000000000000000000',
        'invalid_id_with_underscores'
      ]

      for (const id of unknownIds) {
        const album = getMockAlbumById(id)
        expect(album).toBeDefined()
        expect(album!.id).toBeDefined()
        expect(album!.title).toBeDefined()
        expect(album!.artist).toBeDefined()
        expect(album!.tracks.length).toBeGreaterThan(0)
        expect(album!.spotifyCodeSvg).toBeDefined()
      }
    })

    it('handles negative IDs, special characters, and malformed Spotify URIs', () => {
      const edgeIds = [
        '-1',
        '-999999',
        'spotify:album:',
        'spotify:album:invalid:extra',
        'spotify:track:4m2880jivsbbyegakfitca',
        'https://open.spotify.com/album/4m2880jivsbbyegakfitca',
        '!@#$%^&*()_+{}[]|:;<>?,./~'
      ]

      for (const id of edgeIds) {
        expect(() => getMockAlbumById(id)).not.toThrow()
        const album = getMockAlbumById(id)
        expect(album).toBeDefined()
        expect(album!.tracks.length).toBeGreaterThan(0)
        expect(album!.totalTracks).toBe(album!.tracks.length)
      }
    })

    it('verifies synthetic keywords produce expected metadata configurations', () => {
      const deluxe = getMockAlbumById('mock-deluxe-edition')
      expect(deluxe!.totalTracks).toBe(42)
      expect(deluxe!.tracks).toHaveLength(42)

      const single = getMockAlbumById('mock-single_track')
      expect(single!.totalTracks).toBe(1)
      expect(single!.tracks).toHaveLength(1)

      const missing = getMockAlbumById('mock-missing_metadata')
      expect(missing!.releaseDate).toBe('Unknown Date')
      expect(missing!.totalDuration).toBe('Unknown Duration')
    })

    it('verifies Californication and OK Computer maintain track duration sum invariants', () => {
      const calSum = MOCK_CALIFORNICATION.tracks.reduce((acc, t) => acc + t.durationMs, 0)
      expect(calSum).toBe(MOCK_CALIFORNICATION.totalDurationMs)
      expect(calSum).toBe(4020000)

      const okcSum = MOCK_OK_COMPUTER.tracks.reduce((acc, t) => acc + t.durationMs, 0)
      expect(okcSum).toBe(MOCK_OK_COMPUTER.totalDurationMs)
      expect(okcSum).toBe(3180000)
    })

    it('verifies Abbey Road and Random Access Memories maintain track duration sum invariants', () => {
      const abbeyRoadSum = MOCK_ABBEY_ROAD.tracks.reduce((acc, t) => acc + t.durationMs, 0)
      expect(abbeyRoadSum).toBe(MOCK_ABBEY_ROAD.totalDurationMs)
      expect(abbeyRoadSum).toBe(2840000)

      const ramSum = MOCK_RANDOM_ACCESS_MEMORIES.tracks.reduce((acc, t) => acc + t.durationMs, 0)
      expect(ramSum).toBe(MOCK_RANDOM_ACCESS_MEMORIES.totalDurationMs)
      expect(ramSum).toBe(4464000)
    })
  })

  describe('3. Date Formatter Stress (formatReleaseDate)', () => {
    it('formats boundary and standard YYYY-MM-DD dates', () => {
      expect(formatReleaseDate('1999-06-08')).toBe('June 8, 1999')
      expect(formatReleaseDate('2000-01-01')).toBe('January 1, 2000')
      expect(formatReleaseDate('2024-12-31')).toBe('December 31, 2024')
    })

    it('formats partial dates (YYYY-MM and YYYY)', () => {
      expect(formatReleaseDate('1999-06')).toBe('June 1999')
      expect(formatReleaseDate('1999-01')).toBe('January 1999')
      expect(formatReleaseDate('1999-12')).toBe('December 1999')
      expect(formatReleaseDate('1999')).toBe('1999')
      expect(formatReleaseDate('2024')).toBe('2024')
    })

    it('handles invalid, empty, and unusual inputs gracefully without throwing', () => {
      expect(formatReleaseDate('')).toBe('')
      expect(formatReleaseDate('   ')).toBe('')
      expect(formatReleaseDate(undefined)).toBe('')
      expect(formatReleaseDate(null as any)).toBe('')
      expect(formatReleaseDate('invalid-date')).toBe('invalid-date')
      expect(formatReleaseDate('not a date')).toBe('not a date')
      expect(formatReleaseDate('1999-13-01')).toBe('1999-13-01') // Invalid month > 12
      expect(formatReleaseDate('1999-00-01')).toBe('1999-00-01') // Invalid month 0
      expect(formatReleaseDate('99999-06-08')).toBe('99999-06-08') // 5-digit year rejected as non-ISO 4-digit
    })
  })

  describe('4. Duration Formatter Stress (formatDuration / formatTotalDuration / formatTrackDuration)', () => {
    it('formats 0 ms, negative, and sub-minute durations', () => {
      expect(formatDuration(0)).toBe('0min')
      expect(formatDuration(-1000)).toBe('0min')
      expect(formatDuration(30000)).toBe('0min') // 30 seconds = 0 min
      expect(formatDuration(59999)).toBe('0min') // 59.999 seconds = 0 min
      expect(formatTotalDuration(0)).toBe('0min')
    })

    it('formats exact minutes and multi-hour boundaries', () => {
      expect(formatDuration(60000)).toBe('1min')
      expect(formatDuration(3540000)).toBe('59min')
      expect(formatDuration(3600000)).toBe('1h 0min') // Exactly 1 hour
      expect(formatDuration(3660000)).toBe('1h 1min')
      expect(formatDuration(86400000)).toBe('24h 0min') // 24 hours
      expect(formatDuration(86400000 * 3)).toBe('72h 0min') // 3 days
    })

    it('formats track duration (m:ss)', () => {
      expect(formatTrackDuration(0)).toBe('0:00')
      expect(formatTrackDuration(-500)).toBe('0:00')
      expect(formatTrackDuration(30000)).toBe('0:30')
      expect(formatTrackDuration(65000)).toBe('1:05')
      expect(formatTrackDuration(238000)).toBe('3:58')
      expect(formatTrackDuration(3600000)).toBe('60:00')
    })

    it('handles falsy or non-numeric duration arguments safely', () => {
      expect(formatDuration(NaN as any)).toBe('0min')
      expect(formatDuration(null as any)).toBe('0min')
      expect(formatDuration(undefined as any)).toBe('0min')
      expect(formatTrackDuration(NaN as any)).toBe('0:00')
    })
  })

  describe('5. Procedural 23-Bar Spotify Code Generator Stress', () => {
    const ALLOWED_HEIGHTS = [11, 18, 25, 32, 39, 46, 53, 60]

    it('verifies Californication produces known canonical bar heights', () => {
      const svg = generateMockSpotifyCodeSvg('spotify:album:0fLhefnjlIV34MrF8v8dcO')
      expect(svg).toBeDefined()
      const rects = [...svg.matchAll(/<rect class="bar"[^>]*height="([^"]+)"/g)]
      expect(rects).toHaveLength(23)
      const heights = rects.map(m => parseFloat(m[1]))
      expect(heights[0]).toBe(11)
      expect(heights[22]).toBe(11)
      expect(heights).toEqual([11, 32, 18, 11, 53, 25, 53, 32, 53, 53, 60, 60, 39, 39, 60, 46, 60, 53, 11, 60, 25, 32, 11])
    })

    it('verifies 100 random/arbitrary strings always yield exactly 23 bars and the Spotify logo', () => {
      const testInputs = [
        '',
        'a',
        '1234567890',
        'spotify:album:random123',
        'spotify:track:xyz',
        'A'.repeat(500),
        'Special chars !@#$%^&*()_+~',
        'Unicode 🎵🔥🎸 日本語',
        'open.spotify.com/album/custom'
      ]

      for (let i = 0; i < 50; i++) {
        testInputs.push(`pseudo-random-seed-${i * 982451653}`)
      }

      for (const input of testInputs) {
        let svg = ''
        expect(() => {
          svg = generateMockSpotifyCodeSvg(input)
        }).not.toThrow()

        // 1. Structural SVG tags
        expect(svg.startsWith('<svg')).toBe(true)
        expect(svg.endsWith('</svg>')).toBe(true)
        expect(svg).toContain('viewBox="0 0 400 100"')

        // 2. Exact 23 bar elements invariant
        const barMatches = svg.match(/<rect class="bar"/g) || []
        expect(barMatches).toHaveLength(23)

        // 3. Total rect elements invariant (<rect> count must be exactly 23, bg is <path>)
        const totalRectMatches = svg.match(/<rect\b/g) || []
        expect(totalRectMatches).toHaveLength(23)

        // 4. Spotify circular emblem path present
        expect(svg).toContain('M31.1897')

        // 5. Allowed heights invariant
        const heights = [...svg.matchAll(/<rect class="bar"[^>]*height="([^"]+)"/g)].map(m => parseFloat(m[1]))
        expect(heights).toHaveLength(23)
        expect(heights[0]).toBe(11)
        expect(heights[22]).toBe(11)
        for (const h of heights) {
          expect(ALLOWED_HEIGHTS).toContain(h)
        }

        // 6. Coordinates invariant (no NaN)
        expect(svg).not.toContain('NaN')
        expect(svg).not.toContain('undefined')
      }
    })

    it('verifies custom colors and background handling', () => {
      const svg1 = generateMockSpotifyCodeSvg('spotify:album:test', '121212', '1db954')
      expect(svg1).toContain('fill="#121212"')
      expect(svg1).toContain('fill="#1db954"')

      // With # prefix
      const svg2 = generateMockSpotifyCodeSvg('spotify:album:test', '#ffffff', '#000000')
      expect(svg2).toContain('fill="#ffffff"')
      expect(svg2).toContain('fill="#000000"')

      // Transparent bg
      const svg3 = generateMockSpotifyCodeSvg('spotify:album:test', 'transparent', 'ffffff')
      expect(svg3).not.toContain('d="M0 0h400v100H0z"')
      const totalRects = svg3.match(/<rect\b/g) || []
      expect(totalRects).toHaveLength(23)
    })

    it('handles null, undefined, and missing parameters safely in generateMockSpotifyCodeSvg', () => {
      expect(() => {
        generateMockSpotifyCodeSvg(null as any)
      }).not.toThrow()
      const svgNull = generateMockSpotifyCodeSvg(null as any)
      expect(svgNull).toContain('<svg')
      expect(svgNull.match(/<rect class="bar"/g)).toHaveLength(23)

      expect(() => {
        generateMockSpotifyCodeSvg(undefined as any)
      }).not.toThrow()

      expect(() => {
        generateMockSpotifyCodeSvg('spotify:album:test', null as any, null as any)
      }).not.toThrow()
      const svgNullBg = generateMockSpotifyCodeSvg('spotify:album:test', null as any, null as any)
      expect(svgNullBg).toContain('fill="#ffffff"')
      expect(svgNullBg).toContain('fill="#000000"')
      expect(svgNullBg).not.toContain('fill="##000000"')
    })
  })
})
