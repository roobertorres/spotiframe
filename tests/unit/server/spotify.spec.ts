import { describe, it, expect } from 'vitest'
import {
  MOCK_ALBUMS,
  getMockAlbumById,
  searchMockAlbums,
  formatReleaseDate,
  formatDuration,
  formatTotalDuration,
  generateMockSpotifyCodeSvg
} from '../../../shared/mockData'
import { rewriteItunesUrl } from '../../../server/utils/coverFallback'

describe('Spotify Mock Provider & Data Transformations', () => {
  it('verifies Californication mock fixture contains exact required schema and values', () => {
    const californication = getMockAlbumById('californication')
    expect(californication).toBeDefined()
    expect(californication!.title).toBe('Californication')
    expect(californication!.artist).toBe('Red Hot Chili Peppers')
    expect(californication!.releaseDate).toBe('June 8, 1999')
    expect(californication!.totalDuration).toBe('1h 7min')
    expect(californication!.tracks).toHaveLength(15)

    // Verify track structure and sequence
    const trackNames = californication!.tracks.map(t => t.name)
    expect(trackNames[0]).toBe('Around the World')
    expect(trackNames[5]).toBe('Californication')
    expect(trackNames[14]).toBe("Road Trippin'")

    californication!.tracks.forEach((track, index) => {
      expect(track.trackNumber).toBe(index + 1)
      expect(track.durationMs).toBeGreaterThan(0)
      expect(typeof track.name).toBe('string')
    })
  })

  it('verifies additional canned fixtures match their specifications', () => {
    const okComputer = getMockAlbumById('ok-computer')
    expect(okComputer).toBeDefined()
    expect(okComputer!.title).toBe('OK Computer')
    expect(okComputer!.artist).toBe('Radiohead')
    expect(okComputer!.releaseDate).toBe('May 21, 1997')
    expect(okComputer!.totalDuration).toBe('53min')
    expect(okComputer!.tracks).toHaveLength(12)

    const abbeyRoad = getMockAlbumById('abbey-road')
    expect(abbeyRoad).toBeDefined()
    expect(abbeyRoad!.title).toBe('Abbey Road')
    expect(abbeyRoad!.artist).toBe('The Beatles')
    expect(abbeyRoad!.releaseDate).toBe('September 26, 1969')
    expect(abbeyRoad!.totalDuration).toBe('47min')
    expect(abbeyRoad!.tracks).toHaveLength(17)

    const ram = getMockAlbumById('random-access-memories')
    expect(ram).toBeDefined()
    expect(ram!.title).toBe('Random Access Memories')
    expect(ram!.artist).toBe('Daft Punk')
    expect(ram!.releaseDate).toBe('May 17, 2013')
    expect(ram!.totalDuration).toBe('1h 14min')
    expect(ram!.tracks).toHaveLength(13)
  })

  describe('formatReleaseDate helper', () => {
    it('formats ISO YYYY-MM-DD dates in UTC avoiding timezone drift', () => {
      expect(formatReleaseDate('1999-06-08')).toBe('June 8, 1999')
      expect(formatReleaseDate('1997-05-21')).toBe('May 21, 1997')
      expect(formatReleaseDate('1969-09-26')).toBe('September 26, 1969')
      expect(formatReleaseDate('2013-05-17')).toBe('May 17, 2013')
    })

    it('handles year-month and year-only inputs gracefully', () => {
      expect(formatReleaseDate('1999-06')).toBe('June 1999')
      expect(formatReleaseDate('1999')).toBe('1999')
      expect(formatReleaseDate('')).toBe('')
      expect(formatReleaseDate(undefined)).toBe('')
    })
  })

  describe('formatTotalDuration helper', () => {
    it('formats durations under one hour as Xmin', () => {
      expect(formatTotalDuration(3180000)).toBe('53min')
      expect(formatTotalDuration(2820000)).toBe('47min')
      expect(formatTotalDuration(60000)).toBe('1min')
    })

    it('formats durations over one hour as Xh Ymin', () => {
      expect(formatTotalDuration(4020000)).toBe('1h 7min')
      expect(formatTotalDuration(4440000)).toBe('1h 14min')
      expect(formatTotalDuration(7200000)).toBe('2h 0min')
    })
  })

  describe('searchMockAlbums helper', () => {
    it('returns exact match for known fixture search queries', () => {
      const results = searchMockAlbums('Californication')
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].name).toBe('Californication')
      expect(results[0].artist).toBe('Red Hot Chili Peppers')
      expect(results[0].totalTracks).toBe(15)
    })

    it('synthesizes consistent mock results for arbitrary unknown queries', () => {
      const results = searchMockAlbums('Dark Side of the Moon Pink Floyd')
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].name).toContain('Dark Side of the Moon')
      expect(results[0].totalTracks).toBeGreaterThan(0)
    })
  })

  describe('iTunes 3000px artwork rewrite', () => {
    it('rewrites various Apple mzstatic artwork URLs to 3000x3000bb format', () => {
      const testCases = [
        {
          input: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f/634904078164.png/100x100bb.jpg',
          expected: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f/634904078164.png/3000x3000bb.jpg'
        },
        {
          input: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/13UMGIM63890.rgb.jpg/100x100bb.png',
          expected: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/13UMGIM63890.rgb.jpg/3000x3000bb.png'
        },
        {
          input: 'https://is1-ssl.mzstatic.com/image/thumb/Features/v4/0a/05/7c/dj.rlzzqodr.jpg/100x100-75.jpg',
          expected: 'https://is1-ssl.mzstatic.com/image/thumb/Features/v4/0a/05/7c/dj.rlzzqodr.jpg/3000x3000bb.jpg'
        }
      ]

      testCases.forEach(({ input, expected }) => {
        expect(rewriteItunesUrl(input, 3000)).toBe(expected)
      })
    })
  })

  describe('Procedural 23-Bar Spotify Code Generator', () => {
    it('generates an SVG with exactly 23 vertical barcode bars and the Spotify emblem', () => {
      const svg = generateMockSpotifyCodeSvg('spotify:album:0fLhefnjlIV34MrF8v8dcO')
      expect(svg).toMatch(/<svg[\s\S]*<\/svg>/i)

      const rectMatches = svg.match(/<rect\b/g) || []
      expect(rectMatches.length).toBe(23)

      expect(svg).toMatch(/rx="3.36" ry="3.36"/)
      expect(svg).toMatch(/M31.1897/)
    })
  })
})
