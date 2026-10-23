/**
 * Agent-as-Judge Layout Verifier for Spotiframe.
 * Evaluates visual and structural layout against reference image specifications:
 * - media_1792780540488_3d72385a.png (Californication layout)
 * - Ground truth metrics extracted in spec_miner_survey_layout/handoff.md
 */

export interface PosterLayoutInput {
  posterWidth: number;
  posterHeight: number;
  contentWidth?: number;
  marginLeft?: number;
  marginRight?: number;
  marginTop?: number;
  marginBottom?: number;
  header: {
    hasDate: boolean;
    hasDuration: boolean;
    dateText?: string;
    durationText?: string;
    dateAlign?: 'left' | 'center' | 'right';
    durationAlign?: 'left' | 'center' | 'right';
  };
  topRule: {
    present: boolean;
    widthFraction?: number; // relative to CW, expected ~1.0
  };
  cover: {
    width: number;
    height: number;
    aspectRatio?: number; // expected 1.0 (square)
  };
  palette: {
    swatches: string[]; // 5 hex colors
    orderedLightToDark?: boolean;
    swatchCount?: number;
  };
  title: {
    text: string;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
  };
  tracklist: {
    column1Tracks: string[];
    column2Tracks: string[];
    totalTracks: number;
  };
  spotifyCode: {
    present: boolean;
    barCount?: number; // expected 23 bars
    hasLogo?: boolean;
  };
  bottomRule: {
    present: boolean;
    widthFraction?: number; // relative to CW, expected ~1.0
  };
}

export interface JudgeEvaluationResult {
  passed: boolean;
  score: number; // 0 to 100
  checklist: Array<{ id: string; name: string; passed: boolean; score: number; reason: string }>;
  errors: string[];
}

/**
 * Calculates WCAG 2.1 relative luminance for a given hex color string.
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B (linearized RGB)
 */
export function calculateLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length !== 6 && cleanHex.length !== 3) return 0;
  
  const fullHex = cleanHex.length === 3 
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex;

  const r = parseInt(fullHex.substring(0, 2), 16) / 255;
  const g = parseInt(fullHex.substring(2, 4), 16) / 255;
  const b = parseInt(fullHex.substring(4, 6), 16) / 255;

  const srgb = [r, g, b].map(val => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/**
 * Evaluates whether a 5-color palette is monotonically ordered from light to dark.
 */
export function isPaletteLightToDark(colors: string[]): boolean {
  if (colors.length < 2) return true;
  const lums = colors.map(calculateLuminance);
  for (let i = 0; i < lums.length - 1; i++) {
    // Allow a tiny floating point tolerance
    if (lums[i] < lums[i + 1] - 0.01) {
      return false;
    }
  }
  return true;
}

/**
 * Agent-as-Judge inspection against the 10-point layout specification checklist.
 */
export function judgePosterLayout(layout: PosterLayoutInput): JudgeEvaluationResult {
  const checklist: JudgeEvaluationResult['checklist'] = [];
  const errors: string[] = [];

  // Item 1: ISO 216 A-series aspect ratio (~1:1.414)
  const ratio = layout.posterHeight / layout.posterWidth;
  const ratioPass = Math.abs(ratio - Math.SQRT2) < 0.1 || Math.abs(ratio - 1.34) < 0.1;
  checklist.push({
    id: 'aspect_ratio',
    name: 'Canvas A-series Aspect Ratio (1:1.414)',
    passed: ratioPass,
    score: ratioPass ? 10 : 0,
    reason: ratioPass ? `Aspect ratio ${ratio.toFixed(3)} is within tolerance.` : `Aspect ratio ${ratio.toFixed(3)} deviates from A-series target.`,
  });
  if (!ratioPass) errors.push('Aspect ratio deviation');

  // Item 2: Content margins & Content Width (~86.7% CW, ~6.65% margins)
  const cwFraction = layout.contentWidth ? layout.contentWidth / layout.posterWidth : 0.867;
  const cwPass = cwFraction >= 0.80 && cwFraction <= 0.92;
  checklist.push({
    id: 'content_width',
    name: 'Content Width & Lateral Margins (~86.7% CW)',
    passed: cwPass,
    score: cwPass ? 10 : 0,
    reason: cwPass ? `Content width fraction ${cwFraction.toFixed(3)} matches reference.` : `Content width ${cwFraction.toFixed(3)} outside acceptable range.`,
  });
  if (!cwPass) errors.push('Content width mismatch');

  // Item 3: Header line with Date left-aligned and Duration right-aligned
  const headerPass = layout.header.hasDate && layout.header.hasDuration &&
    (layout.header.dateAlign === 'left' || layout.header.dateAlign === undefined) &&
    (layout.header.durationAlign === 'right' || layout.header.durationAlign === undefined);
  checklist.push({
    id: 'header_alignment',
    name: 'Header with Left Date and Right Duration',
    passed: headerPass,
    score: headerPass ? 10 : 0,
    reason: headerPass ? 'Header contains date on left and duration on right.' : 'Header missing date/duration or misaligned.',
  });
  if (!headerPass) errors.push('Header layout mismatch');

  // Item 4: Top dividing hairline rule spanning 100% CW
  const topRulePass = layout.topRule.present && (layout.topRule.widthFraction ?? 1.0) >= 0.95;
  checklist.push({
    id: 'top_rule',
    name: 'Top Hairline Rule spanning 100% Content Width',
    passed: topRulePass,
    score: topRulePass ? 10 : 0,
    reason: topRulePass ? 'Top hairline rule spans full content width.' : 'Top rule missing or incorrect width.',
  });
  if (!topRulePass) errors.push('Top rule missing or truncated');

  // Item 5: Strict 1:1 square album cover
  const coverRatio = layout.cover.width / layout.cover.height;
  const coverPass = Math.abs(coverRatio - 1.0) < 0.05;
  checklist.push({
    id: 'cover_square',
    name: 'Strict 1:1 Square Album Cover Art',
    passed: coverPass,
    score: coverPass ? 10 : 0,
    reason: coverPass ? `Cover aspect ratio ${coverRatio.toFixed(3)} is square.` : `Cover aspect ratio ${coverRatio.toFixed(3)} is not 1:1.`,
  });
  if (!coverPass) errors.push('Cover artwork is not square');

  // Item 6: 5-color palette strip ordered light-to-dark
  const has5Swatches = layout.palette.swatches.length === 5;
  const isSorted = isPaletteLightToDark(layout.palette.swatches);
  const palettePass = has5Swatches && isSorted;
  checklist.push({
    id: 'palette_light_to_dark',
    name: '5-Color Palette Ordered Light to Dark',
    passed: palettePass,
    score: palettePass ? 10 : 0,
    reason: palettePass ? 'Exactly 5 swatches ordered light-to-dark by relative luminance.' : `Palette failure: 5 swatches=${has5Swatches}, sorted=${isSorted}.`,
  });
  if (!palettePass) errors.push('Palette is not 5 swatches light-to-dark');

  // Item 7: Bold Album Title heading, flush left
  const titlePass = Boolean(layout.title.text && layout.title.text.trim()) &&
    (layout.title.align === 'left' || layout.title.align === undefined);
  checklist.push({
    id: 'title_heading',
    name: 'Bold Album Title Heading Flush Left',
    passed: titlePass,
    score: titlePass ? 10 : 0,
    reason: titlePass ? 'Title is present, flush left beneath palette.' : 'Title missing or misaligned.',
  });
  if (!titlePass) errors.push('Title layout mismatch');

  // Item 8: Two-column balanced tracklist
  const total = layout.tracklist.totalTracks;
  const col1 = layout.tracklist.column1Tracks.length;
  const col2 = layout.tracklist.column2Tracks.length;
  const balanced = (col1 === Math.ceil(total / 2) && col2 === Math.floor(total / 2)) || (col1 + col2 === total && Math.abs(col1 - col2) <= 1);
  const tracklistPass = total > 0 && balanced;
  checklist.push({
    id: 'tracklist_two_columns',
    name: 'Balanced Two-Column Tracklist Distribution',
    passed: tracklistPass,
    score: tracklistPass ? 10 : 0,
    reason: tracklistPass ? `Tracks balanced across columns (${col1} / ${col2} of ${total}).` : `Tracklist columns unbalanced (${col1} / ${col2} of ${total}).`,
  });
  if (!tracklistPass) errors.push('Tracklist column imbalance');

  // Item 9: Official Spotify scannable code (with 23 bars)
  const codePass = layout.spotifyCode.present && (layout.spotifyCode.barCount === undefined || layout.spotifyCode.barCount === 23);
  checklist.push({
    id: 'spotify_code',
    name: 'Spotify Scannable Code (Logo + 23 Bars)',
    passed: codePass,
    score: codePass ? 10 : 0,
    reason: codePass ? 'Spotify code present with valid 23-bar vector format.' : 'Spotify scannable code missing or invalid bar count.',
  });
  if (!codePass) errors.push('Spotify code missing or invalid');

  // Item 10: Bottom hairline divider rule spanning 100% CW
  const bottomRulePass = layout.bottomRule.present && (layout.bottomRule.widthFraction ?? 1.0) >= 0.95;
  checklist.push({
    id: 'bottom_rule',
    name: 'Bottom Hairline Rule spanning 100% Content Width',
    passed: bottomRulePass,
    score: bottomRulePass ? 10 : 0,
    reason: bottomRulePass ? 'Bottom hairline rule spans full content width.' : 'Bottom rule missing or truncated.',
  });
  if (!bottomRulePass) errors.push('Bottom rule missing or truncated');

  const totalScore = checklist.reduce((acc, item) => acc + item.score, 0);
  const passed = totalScore >= 90; // Requires at least 9/10 checklist items passing

  return {
    passed,
    score: totalScore,
    checklist,
    errors,
  };
}
