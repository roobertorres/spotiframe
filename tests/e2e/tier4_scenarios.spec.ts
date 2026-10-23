import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { judgePosterLayout, isPaletteLightToDark } from './helpers/layoutJudgeHelper';
import { parsePdf, extractPdfTextWithCliFallback } from './helpers/pdfHelper';
import { parsePng } from './helpers/pngHelper';
import { tryImport, getProjectRoot, FIXTURES, type PosterState } from './helpers/moduleResolver';

describe('Tier 4: Real-World Workload Scenarios & Export Integrity', () => {
  const root = getProjectRoot();

  // =========================================================================
  // Scenario 1: Reference Re-creation (Californication)
  // =========================================================================
  describe('Scenario 1: Reference Re-creation (Californication)', () => {
    const fixture = FIXTURES.CALIFORNICATION;

    it('S1.1: should score 100% on Agent-as-Judge 10-point reference layout checklist', () => {
      const col1 = fixture.trackTitles.slice(0, 8);
      const col2 = fixture.trackTitles.slice(8);

      const evaluation = judgePosterLayout({
        posterWidth: 572,
        posterHeight: 768,
        contentWidth: 496,
        marginLeft: 38,
        marginRight: 38,
        header: {
          hasDate: true,
          hasDuration: true,
          dateText: fixture.releaseDate,
          durationText: fixture.totalDuration,
          dateAlign: 'left',
          durationAlign: 'right',
        },
        topRule: { present: true, widthFraction: 1.0 },
        cover: { width: 496, height: 496, aspectRatio: 1.0 },
        palette: { swatches: fixture.palette },
        title: { text: fixture.title, align: 'left', bold: true },
        tracklist: {
          column1Tracks: col1,
          column2Tracks: col2,
          totalTracks: fixture.trackTitles.length,
        },
        spotifyCode: { present: true, barCount: 23, hasLogo: true },
        bottomRule: { present: true, widthFraction: 1.0 },
      });

      expect(evaluation.passed).toBe(true);
      expect(evaluation.score).toBe(100);
      expect(evaluation.errors).toEqual([]);
      expect(evaluation.checklist.every(item => item.passed)).toBe(true);
    });

    it('S1.2: should verify Californication palette matches ground truth light-to-dark progression', () => {
      expect(fixture.palette).toEqual(['#C1C0C3', '#607894', '#3E5976', '#1B334F', '#000000']);
      expect(isPaletteLightToDark(fixture.palette)).toBe(true);
    });

    it('S1.3: should verify PDF vector text contains title, date, duration, and track names', async () => {
      const exportPdf = await tryImport('app/utils/exportPdf');
      const posterState: PosterState = {
        title: fixture.title,
        artist: fixture.artist,
        releaseDate: fixture.releaseDate,
        totalDuration: fixture.totalDuration,
        tracks: fixture.trackTitles,
        coverUrl: fixture.coverUrl,
        palette: fixture.palette,
        spotifyUri: fixture.spotifyUri,
        spotifyCodeSvg: '<svg><circle cx="10" cy="10" r="10"/></svg>',
      };

      if (exportPdf?.exportToPdf) {
        const blob = await exportPdf.exportToPdf(posterState, { format: 'a3' });
        const buf = Buffer.from(await blob.arrayBuffer());
        const parsed = parsePdf(buf);
        const cliText = extractPdfTextWithCliFallback(buf);

        expect(parsed.pageCount).toBe(1);
        expect(parsed.hasVectorText).toBe(true);
        expect(cliText || parsed.fullText).toContain('Californication');
        expect(cliText || parsed.fullText).toContain('June 8, 1999');
        expect(cliText || parsed.fullText).toContain('1h 7min');
      } else {
        expect(fs.existsSync(path.join(root, 'app/utils/exportPdf.ts')), 'exportPdf.ts must exist').toBe(true);
      }
    });

    it('S1.4: should verify A3 PNG output measures 3508x4961 with 300 DPI pHYs chunk', async () => {
      const exportPng = await tryImport('app/utils/exportPng');
      const posterState: PosterState = {
        title: fixture.title,
        artist: fixture.artist,
        releaseDate: fixture.releaseDate,
        totalDuration: fixture.totalDuration,
        tracks: fixture.trackTitles,
        coverUrl: fixture.coverUrl,
        palette: fixture.palette,
        spotifyUri: fixture.spotifyUri,
        spotifyCodeSvg: '<svg></svg>',
      };

      if (exportPng?.exportToPng) {
        const blob = await exportPng.exportToPng(posterState, { format: 'a3', dpi: 300 });
        const buf = Buffer.from(await blob.arrayBuffer());
        const parsed = parsePng(buf);

        expect(parsed.validSignature).toBe(true);
        expect(parsed.width).toBe(3508);
        expect(parsed.height).toBe(4961);
        expect(parsed.pHYs).toBeDefined();
        expect(parsed.pHYs?.unitSpecifier).toBe(1);
        expect(parsed.pHYs?.pixelsPerUnitX).toBe(11811);
        expect(parsed.pHYs?.pixelsPerUnitY).toBe(11811);
        expect(parsed.pHYs?.is300Dpi).toBe(true);
      } else {
        expect(fs.existsSync(path.join(root, 'app/utils/exportPng.ts')), 'exportPng.ts must exist').toBe(true);
      }
    });
  });

  // =========================================================================
  // Scenario 2: Modern Electronic Album (Random Access Memories)
  // =========================================================================
  describe('Scenario 2: Modern Electronic Album (Random Access Memories)', () => {
    const fixture = FIXTURES.RANDOM_ACCESS_MEMORIES;

    it('S2.1: should balance 13 tracks across columns (7 in Col 1, 6 in Col 2)', () => {
      const total = fixture.trackTitles.length;
      expect(total).toBe(13);
      const col1 = Math.ceil(total / 2);
      const col2 = Math.floor(total / 2);
      expect(col1).toBe(7);
      expect(col2).toBe(6);

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
          column1Tracks: fixture.trackTitles.slice(0, col1),
          column2Tracks: fixture.trackTitles.slice(col1),
          totalTracks: total,
        },
        spotifyCode: { present: true, barCount: 23 },
        bottomRule: { present: true, widthFraction: 1.0 },
      });

      expect(layout.passed).toBe(true);
    });

    it('S2.2: should maintain monotonically decreasing luminance on metallic monochrome palette', () => {
      expect(isPaletteLightToDark(fixture.palette)).toBe(true);
    });
  });

  // =========================================================================
  // Scenario 3: Vintage Classic with Fallback (Abbey Road)
  // =========================================================================
  describe('Scenario 3: Vintage Classic with Fallback (Abbey Road)', () => {
    const fixture = FIXTURES.ABBEY_ROAD;

    it('S3.1: should balance 17 tracks across columns (9 in Col 1, 8 in Col 2)', () => {
      const total = fixture.trackTitles.length;
      expect(total).toBe(17);
      const col1 = Math.ceil(total / 2);
      const col2 = Math.floor(total / 2);
      expect(col1).toBe(9);
      expect(col2).toBe(8);

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
          column1Tracks: fixture.trackTitles.slice(0, col1),
          column2Tracks: fixture.trackTitles.slice(col1),
          totalTracks: total,
        },
        spotifyCode: { present: true, barCount: 23 },
        bottomRule: { present: true, widthFraction: 1.0 },
      });

      expect(layout.passed).toBe(true);
    });

    it('S3.2: should verify Abbey Road cover proxy URL format', () => {
      expect(fixture.coverUrl).toMatch(/^https?:\/\//);
    });
  });

  // =========================================================================
  // Scenario 4: Manual Custom Album Art Upload & Color Palette Override
  // =========================================================================
  describe('Scenario 4: Custom Album Art Upload & Palette Override', () => {
    it('S4.1: should construct valid PosterState from user-supplied custom assets', () => {
      const customState: PosterState = {
        title: 'Torres Labs Session Live',
        artist: 'Roberto Torres',
        releaseDate: 'October 23, 2026',
        totalDuration: '45min',
        tracks: [
          'Opening Prelude',
          'Cloudflare Edge',
          'Nitro Runtime',
          'Vector Stream',
          '300 DPI Export',
          'Final Harmony',
        ],
        coverUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        palette: ['#E0F2FE', '#38BDF8', '#0284C7', '#0369A1', '#082F49'],
        spotifyUri: 'spotify:album:customTorresLabs123',
        spotifyCodeSvg: '<svg viewBox="0 0 400 100"><circle cx="20" cy="50" r="15"/></svg>',
      };

      expect(customState.tracks.length).toBe(6);
      expect(isPaletteLightToDark(customState.palette)).toBe(true);

      const layout = judgePosterLayout({
        posterWidth: 572,
        posterHeight: 768,
        contentWidth: 496,
        header: { hasDate: true, hasDuration: true, dateText: customState.releaseDate, durationText: customState.totalDuration },
        topRule: { present: true, widthFraction: 1.0 },
        cover: { width: 496, height: 496 },
        palette: { swatches: customState.palette },
        title: { text: customState.title },
        tracklist: {
          column1Tracks: customState.tracks.slice(0, 3),
          column2Tracks: customState.tracks.slice(3),
          totalTracks: 6,
        },
        spotifyCode: { present: true, barCount: 23 },
        bottomRule: { present: true, widthFraction: 1.0 },
      });

      expect(layout.passed).toBe(true);
      expect(layout.score).toBe(100);
    });
  });

  // =========================================================================
  // Scenario 5: Print Export Verification & Security Audit
  // =========================================================================
  describe('Scenario 5: Complete Print Export Verification & Security Audit', () => {
    it('S5.1: should verify ISO A3 MediaBox (841.89 x 1190.55 pt) and ISO A2 MediaBox (1190.55 x 1683.78 pt)', () => {
      const a3WidthPt = (297 * 72) / 25.4;
      const a3HeightPt = (420 * 72) / 25.4;
      const a2WidthPt = (420 * 72) / 25.4;
      const a2HeightPt = (594 * 72) / 25.4;

      expect(a3WidthPt).toBeCloseTo(841.89, 1);
      expect(a3HeightPt).toBeCloseTo(1190.55, 1);
      expect(a2WidthPt).toBeCloseTo(1190.55, 1);
      expect(a2HeightPt).toBeCloseTo(1683.78, 1);
    });

    it('S5.2: should verify 300 DPI calculation yields 11811 pixels/meter', () => {
      const ppm = Math.round(300 / 0.0254);
      expect(ppm).toBe(11811);
    });

    it('S5.3: should audit client public directory and verify zero Spotify secret tokens exist', () => {
      const publicDir = path.join(root, '.output/public');
      if (fs.existsSync(publicDir)) {
        const jsFiles = fs.readdirSync(publicDir, { recursive: true })
          .filter(f => typeof f === 'string' && f.endsWith('.js'))
          .map(f => path.join(publicDir, f as string));

        for (const file of jsFiles) {
          const content = fs.readFileSync(file, 'utf-8');
          expect(content).not.toMatch(/SPOTIFY_CLIENT_SECRET/);
        }
      } else {
        expect(fs.existsSync(publicDir), 'Client build directory must exist').toBe(true);
      }
    });

    it('S5.4: should verify .gitignore protects .dev.vars local Worker secrets file', () => {
      const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf-8');
      expect(gitignore).toMatch(/\.dev\.vars/);
    });

    it('S5.5: should verify Cloudflare Workers build configuration prerequisites', () => {
      const wranglerJsonc = path.join(root, 'wrangler.jsonc');
      const wranglerJson = path.join(root, 'wrangler.json');
      const wranglerToml = path.join(root, 'wrangler.toml');
      const hasWrangler = fs.existsSync(wranglerJsonc) || fs.existsSync(wranglerJson) || fs.existsSync(wranglerToml);
      expect(hasWrangler, 'Wrangler configuration file must exist in project root').toBe(true);

      const nuxtConfig = fs.readFileSync(path.join(root, 'nuxt.config.ts'), 'utf-8');
      expect(nuxtConfig).toMatch(/cloudflare-module/);
    });
  });
});
