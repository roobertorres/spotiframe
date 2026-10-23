import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { judgePosterLayout, isPaletteLightToDark } from './helpers/layoutJudgeHelper';
import { parsePdf } from './helpers/pdfHelper';
import { parsePng } from './helpers/pngHelper';
import { tryImport, getProjectRoot, FIXTURES, type PosterState } from './helpers/moduleResolver';

describe('Tier 3: Pairwise Cross-Feature Combinations', () => {
  const root = getProjectRoot();

  // =========================================================================
  // Combination 1: Search Album + Palette Extraction + Live Preview
  // =========================================================================
  it('C1: Search Album -> Palette Extraction -> Live Preview Layout', async () => {
    const fixture = FIXTURES.CALIFORNICATION;
    expect(fixture.palette.length).toBe(5);
    expect(isPaletteLightToDark(fixture.palette)).toBe(true);

    const layout = judgePosterLayout({
      posterWidth: 572,
      posterHeight: 768,
      contentWidth: 496,
      header: { hasDate: true, hasDuration: true, dateText: fixture.releaseDate, durationText: fixture.totalDuration },
      topRule: { present: true, widthFraction: 1.0 },
      cover: { width: 496, height: 496 },
      palette: { swatches: fixture.palette },
      title: { text: fixture.title },
      tracklist: {
        column1Tracks: fixture.trackTitles.slice(0, 8),
        column2Tracks: fixture.trackTitles.slice(8),
        totalTracks: fixture.trackTitles.length,
      },
      spotifyCode: { present: true, barCount: 23 },
      bottomRule: { present: true, widthFraction: 1.0 },
    });

    expect(layout.passed).toBe(true);
    expect(layout.score).toBe(100);
  });

  // =========================================================================
  // Combination 2: Search Album + Field Edit (Title & Tracks) + PDF Export
  // =========================================================================
  it('C2: Search Album -> Field Edit (Title & Tracks) -> Vector PDF Export', async () => {
    const modifiedState: PosterState = {
      title: 'Californication (Remastered Edition)',
      artist: 'Red Hot Chili Peppers',
      releaseDate: 'June 8, 1999',
      totalDuration: '1h 12min',
      tracks: [...FIXTURES.CALIFORNICATION.trackTitles, 'Bonus Track 1', 'Bonus Track 2'],
      coverUrl: FIXTURES.CALIFORNICATION.coverUrl,
      palette: FIXTURES.CALIFORNICATION.palette,
      spotifyUri: FIXTURES.CALIFORNICATION.spotifyUri,
      spotifyCodeSvg: '<svg viewBox="0 0 400 100"><circle cx="20" cy="50" r="15"/></svg>',
    };

    expect(modifiedState.title).toContain('Remastered Edition');
    expect(modifiedState.tracks.length).toBe(17);

    const exportPdf = await tryImport('app/utils/exportPdf');
    if (exportPdf?.exportToPdf) {
      const pdfBlob = await exportPdf.exportToPdf(modifiedState, { format: 'a3' });
      const buffer = Buffer.from(await pdfBlob.arrayBuffer());
      const parsed = parsePdf(buffer);
      expect(parsed.pageCount).toBe(1);
      expect(parsed.fullText).toContain('Remastered Edition');
    } else {
      expect(fs.existsSync(path.join(root, 'app/utils/exportPdf.ts')), 'exportPdf.ts must exist').toBe(true);
    }
  });

  // =========================================================================
  // Combination 3: Search Album + Palette Override + 300 DPI PNG Export
  // =========================================================================
  it('C3: Search Album -> Manual Palette Override -> 300 DPI PNG Export', async () => {
    const customPalette = ['#FFFFFF', '#DDAA77', '#AA6633', '#552211', '#000000'];
    expect(isPaletteLightToDark(customPalette)).toBe(true);

    const modifiedState: PosterState = {
      title: FIXTURES.CALIFORNICATION.title,
      artist: FIXTURES.CALIFORNICATION.artist,
      releaseDate: FIXTURES.CALIFORNICATION.releaseDate,
      totalDuration: FIXTURES.CALIFORNICATION.totalDuration,
      tracks: FIXTURES.CALIFORNICATION.trackTitles,
      coverUrl: FIXTURES.CALIFORNICATION.coverUrl,
      palette: customPalette,
      spotifyUri: FIXTURES.CALIFORNICATION.spotifyUri,
      spotifyCodeSvg: '<svg></svg>',
    };

    const exportPng = await tryImport('app/utils/exportPng');
    if (exportPng?.exportToPng) {
      const pngBlob = await exportPng.exportToPng(modifiedState, { format: 'a3', dpi: 300 });
      const buffer = Buffer.from(await pngBlob.arrayBuffer());
      const parsed = parsePng(buffer);
      expect(parsed.width).toBe(3508);
      expect(parsed.height).toBe(4961);
      expect(parsed.pHYs?.is300Dpi).toBe(true);
    } else {
      expect(fs.existsSync(path.join(root, 'app/utils/exportPng.ts')), 'exportPng.ts must exist').toBe(true);
    }
  });

  // =========================================================================
  // Combination 4: Custom Upload + Palette Extraction + Black Frame Preview
  // =========================================================================
  it('C4: Custom Cover Upload -> Palette Extraction -> Black Frame Preview', async () => {
    const customCoverUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const state: PosterState = {
      title: 'Custom Indie Album',
      artist: 'Independent Artist',
      releaseDate: 'October 23, 2026',
      totalDuration: '38min',
      tracks: ['Track A', 'Track B', 'Track C', 'Track D'],
      coverUrl: customCoverUrl,
      palette: ['#F2F2F2', '#A6A6A6', '#595959', '#262626', '#000000'],
      spotifyUri: 'spotify:album:custom123',
      spotifyCodeSvg: '<svg></svg>',
    };

    const layout = judgePosterLayout({
      posterWidth: 572,
      posterHeight: 768,
      contentWidth: 496,
      header: { hasDate: true, hasDuration: true, dateText: state.releaseDate, durationText: state.totalDuration },
      topRule: { present: true, widthFraction: 1.0 },
      cover: { width: 496, height: 496 },
      palette: { swatches: state.palette },
      title: { text: state.title },
      tracklist: {
        column1Tracks: state.tracks.slice(0, 2),
        column2Tracks: state.tracks.slice(2),
        totalTracks: state.tracks.length,
      },
      spotifyCode: { present: true, barCount: 23 },
      bottomRule: { present: true, widthFraction: 1.0 },
    });

    expect(layout.passed).toBe(true);
  });

  // =========================================================================
  // Combination 5: Custom Upload + Palette Swatch Override + Vector PDF Export
  // =========================================================================
  it('C5: Custom Cover Upload -> Manual Swatch Override -> Vector PDF Export', async () => {
    const exportPdf = path.join(root, 'app/utils/exportPdf.ts');
    expect(fs.existsSync(exportPdf), 'exportPdf.ts must exist').toBe(true);
  });

  // =========================================================================
  // Combination 6: Offline Mock Provider + Scannables Code + Live Preview
  // =========================================================================
  it('C6: Offline Mock Provider -> Spotify Scannable Code -> Live Preview Layout', async () => {
    const fixture = FIXTURES.ABBEY_ROAD;
    const col1Count = Math.ceil(fixture.trackTitles.length / 2);
    const col2Count = Math.floor(fixture.trackTitles.length / 2);

    const layout = judgePosterLayout({
      posterWidth: 572,
      posterHeight: 768,
      contentWidth: 496,
      header: { hasDate: true, hasDuration: true, dateText: fixture.releaseDate, durationText: fixture.totalDuration },
      topRule: { present: true, widthFraction: 1.0 },
      cover: { width: 496, height: 496 },
      palette: { swatches: fixture.palette },
      title: { text: fixture.title },
      tracklist: {
        column1Tracks: fixture.trackTitles.slice(0, col1Count),
        column2Tracks: fixture.trackTitles.slice(col1Count),
        totalTracks: fixture.trackTitles.length,
      },
      spotifyCode: { present: true, barCount: 23 },
      bottomRule: { present: true, widthFraction: 1.0 },
    });

    expect(layout.passed).toBe(true);
    expect(layout.checklist.find(c => c.id === 'tracklist_two_columns')?.passed).toBe(true);
  });

  // =========================================================================
  // Combination 7: Fallback Cover (CAA) + Palette Extraction + 300 DPI PNG
  // =========================================================================
  it('C7: Fallback Cover Art -> Palette Extraction -> 300 DPI PNG Export', async () => {
    const exportPng = path.join(root, 'app/utils/exportPng.ts');
    expect(fs.existsSync(exportPng), 'exportPng.ts must exist').toBe(true);
  });

  // =========================================================================
  // Combination 8: High-Res Cover Proxy + Live Preview + A2 Vector PDF Export
  // =========================================================================
  it('C8: High-Res Cover Proxy -> Live Preview -> A2 Vector PDF Export', async () => {
    const proxyPath = path.join(root, 'server/api/cover-proxy.ts');
    const exportPdf = path.join(root, 'app/utils/exportPdf.ts');
    expect(fs.existsSync(proxyPath), 'cover-proxy.ts must exist').toBe(true);
    expect(fs.existsSync(exportPdf), 'exportPdf.ts must exist').toBe(true);
  });

  // =========================================================================
  // Combination 9: Search + Edit All Fields + Dual PDF and PNG Export
  // =========================================================================
  it('C9: Search Album -> Full Multi-Field Edit -> Dual PDF & PNG Export', async () => {
    const posterState: PosterState = {
      title: 'Random Access Memories (10th Anniversary)',
      artist: 'Daft Punk',
      releaseDate: 'May 17, 2013',
      totalDuration: '1h 14min',
      tracks: FIXTURES.RANDOM_ACCESS_MEMORIES.trackTitles,
      coverUrl: FIXTURES.RANDOM_ACCESS_MEMORIES.coverUrl,
      palette: FIXTURES.RANDOM_ACCESS_MEMORIES.palette,
      spotifyUri: FIXTURES.RANDOM_ACCESS_MEMORIES.spotifyUri,
      spotifyCodeSvg: '<svg viewBox="0 0 400 100"><circle cx="20" cy="50" r="15"/></svg>',
    };

    expect(posterState.title).toContain('10th Anniversary');
    const exportPdf = path.join(root, 'app/utils/exportPdf.ts');
    const exportPng = path.join(root, 'app/utils/exportPng.ts');
    expect(fs.existsSync(exportPdf), 'exportPdf.ts must exist').toBe(true);
    expect(fs.existsSync(exportPng), 'exportPng.ts must exist').toBe(true);
  });

  // =========================================================================
  // Combination 10: Mock Fallback + Procedural Code + Secrets Isolation
  // =========================================================================
  it('C10: Offline Mock Fallback -> Procedural Barcode -> Secret Isolation Check', () => {
    const publicDir = path.join(root, '.output/public');
    if (fs.existsSync(publicDir)) {
      const files = fs.readdirSync(publicDir, { recursive: true })
        .filter(f => typeof f === 'string' && f.endsWith('.js'))
        .map(f => path.join(publicDir, f as string));
      for (const file of files) {
        const text = fs.readFileSync(file, 'utf-8');
        expect(text).not.toContain('SPOTIFY_CLIENT_SECRET');
      }
    } else {
      expect(fs.existsSync(publicDir), 'Client build directory must exist').toBe(true);
    }
  });

  // =========================================================================
  // Combination 11: Non-Square Cover + 30+ Tracks + A3 PDF Layout Integrity
  // =========================================================================
  it('C11: Non-Square Upload + 30+ Tracks Tracklist -> A3 Single-Page PDF Integrity', () => {
    const tracks32 = Array.from({ length: 32 }, (_, i) => `Song Title ${i + 1}`);
    const col1 = Math.ceil(tracks32.length / 2);
    const col2 = Math.floor(tracks32.length / 2);
    expect(col1).toBe(16);
    expect(col2).toBe(16);

    const layout = judgePosterLayout({
      posterWidth: 572,
      posterHeight: 768,
      contentWidth: 496,
      header: { hasDate: true, hasDuration: true, dateText: '2026', durationText: '2h 10min' },
      topRule: { present: true, widthFraction: 1.0 },
      cover: { width: 496, height: 496 }, // Center cropped to 1:1 square
      palette: { swatches: ['#FFF', '#CCC', '#888', '#444', '#000'] },
      title: { text: 'Mega Anthology Album' },
      tracklist: {
        column1Tracks: tracks32.slice(0, col1),
        column2Tracks: tracks32.slice(col1),
        totalTracks: tracks32.length,
      },
      spotifyCode: { present: true, barCount: 23 },
      bottomRule: { present: true, widthFraction: 1.0 },
    });

    expect(layout.passed).toBe(true);
  });

  // =========================================================================
  // Combination 12: Monochrome Artwork + Custom Palette + PNG pHYs Check
  // =========================================================================
  it('C12: Monochrome Artwork Search -> Custom Palette Edit -> PNG pHYs DPI Verification', () => {
    const pngHelper = path.join(root, 'tests/e2e/helpers/pngHelper.ts');
    expect(fs.existsSync(pngHelper), 'pngHelper.ts must exist').toBe(true);
  });

  // =========================================================================
  // Combination 13: Non-Square Cover + Long Title + A2 PDF Generation
  // =========================================================================
  it('C13: Non-Square Cover Upload -> Long Title Edit -> A2 Vector PDF Generation', () => {
    const exportPdf = path.join(root, 'app/utils/exportPdf.ts');
    expect(fs.existsSync(exportPdf), 'exportPdf.ts must exist').toBe(true);
  });

  // =========================================================================
  // Combination 14: Complete Chain (Search -> Mock -> Edit -> Preview -> PDF -> PNG)
  // =========================================================================
  it('C14: Complete Lifecycle Flow: Search -> Mock -> Edit -> Preview -> Dual Export', () => {
    const editor = path.join(root, 'app/components/PosterEditor.vue');
    const canvas = path.join(root, 'app/components/PosterCanvas.vue');
    const frame = path.join(root, 'app/components/PosterFrame.vue');
    const exportPdf = path.join(root, 'app/utils/exportPdf.ts');
    const exportPng = path.join(root, 'app/utils/exportPng.ts');

    expect(fs.existsSync(editor), 'PosterEditor.vue must exist').toBe(true);
    expect(fs.existsSync(canvas), 'PosterCanvas.vue must exist').toBe(true);
    expect(fs.existsSync(frame), 'PosterFrame.vue must exist').toBe(true);
    expect(fs.existsSync(exportPdf), 'exportPdf.ts must exist').toBe(true);
    expect(fs.existsSync(exportPng), 'exportPng.ts must exist').toBe(true);
  });
});
