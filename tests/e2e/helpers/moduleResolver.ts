import path from 'node:path';
import fs from 'node:fs';

export interface AlbumSearchResult {
  id: string;
  name: string;
  artist: string;
  releaseDate: string;
  coverUrl: string;
  totalTracks: number;
}

export interface AlbumTrack {
  id: string;
  name: string;
  trackNumber: number;
  durationMs: number;
}

export interface AlbumData {
  id: string;
  title: string;
  artist: string;
  releaseDate: string;
  totalDuration: string;
  tracks: AlbumTrack[];
  coverUrl: string;
  spotifyUri: string;
  spotifyCodeSvg?: string;
}

export interface PosterState {
  title: string;
  artist: string;
  releaseDate: string;
  totalDuration: string;
  tracks: string[];
  coverUrl: string;
  palette: string[];
  spotifyUri: string;
  spotifyCodeSvg: string;
}

/**
 * Standard Authoritative Fixtures derived from ORIGINAL_REQUEST.md & spec_miner_survey_layout
 */
export const FIXTURES = {
  CALIFORNICATION: {
    id: '0fLhefnjlIV34MrF8v8dcO',
    title: 'Californication',
    artist: 'Red Hot Chili Peppers',
    releaseDate: 'June 8, 1999',
    totalDuration: '1h 7min',
    tracks: [
      { id: '1', name: 'Around the World', trackNumber: 1, durationMs: 238000 },
      { id: '2', name: 'Parallel Universe', trackNumber: 2, durationMs: 270000 },
      { id: '3', name: 'Scar Tissue', trackNumber: 3, durationMs: 217000 },
      { id: '4', name: 'Otherside', trackNumber: 4, durationMs: 255000 },
      { id: '5', name: 'Get on Top', trackNumber: 5, durationMs: 198000 },
      { id: '6', name: 'Californication', trackNumber: 6, durationMs: 321000 },
      { id: '7', name: 'Easily', trackNumber: 7, durationMs: 231000 },
      { id: '8', name: 'Porcelain', trackNumber: 8, durationMs: 163000 },
      { id: '9', name: 'Emit Remmus', trackNumber: 9, durationMs: 240000 },
      { id: '10', name: 'I Like Dirt', trackNumber: 10, durationMs: 157000 },
      { id: '11', name: 'This Velvet Glove', trackNumber: 11, durationMs: 225000 },
      { id: '12', name: 'Savior', trackNumber: 12, durationMs: 292000 },
      { id: '13', name: 'Purple Stain', trackNumber: 13, durationMs: 253000 },
      { id: '14', name: 'Right on Time', trackNumber: 14, durationMs: 112000 },
      { id: '15', name: "Road Trippin'", trackNumber: 15, durationMs: 205000 },
    ],
    trackTitles: [
      'Around the World',
      'Parallel Universe',
      'Scar Tissue',
      'Otherside',
      'Get on Top',
      'Californication',
      'Easily',
      'Porcelain',
      'Emit Remmus',
      'I Like Dirt',
      'This Velvet Glove',
      'Savior',
      'Purple Stain',
      'Right on Time',
      "Road Trippin'",
    ],
    palette: ['#C1C0C3', '#607894', '#3E5976', '#1B334F', '#000000'],
    coverUrl: 'https://i.scdn.co/image/ab67616d0000b2737359994525d219f64872d3b1',
    spotifyUri: 'spotify:album:0fLhefnjlIV34MrF8v8dcO',
  },
  RANDOM_ACCESS_MEMORIES: {
    id: '4m2880jivSbbyEGAKfITCa',
    title: 'Random Access Memories',
    artist: 'Daft Punk',
    releaseDate: 'May 17, 2013',
    totalDuration: '1h 14min',
    trackTitles: [
      'Give Life Back to Music',
      'The Game of Love',
      'Giorgio by Moroder',
      'Within',
      'Instant Crush',
      'Lose Yourself to Dance',
      'Touch',
      'Get Lucky',
      'Beyond',
      'Motherboard',
      'Fragments of Time',
      'Doin\' It Right',
      'Contact',
    ],
    palette: ['#E6E6E6', '#9B9B9B', '#4A4A4A', '#1C1C1C', '#0A0A0A'],
    coverUrl: 'https://i.scdn.co/image/ab67616d0000b273b52d92d8f99059637cf216a6',
    spotifyUri: 'spotify:album:4m2880jivSbbyEGAKfITCa',
  },
  ABBEY_ROAD: {
    id: '0ETFjACtuP2ADo6LFhL6HN',
    title: 'Abbey Road',
    artist: 'The Beatles',
    releaseDate: 'September 26, 1969',
    totalDuration: '47min',
    trackTitles: [
      'Come Together',
      'Something',
      'Maxwell\'s Silver Hammer',
      'Oh! Darling',
      'Octopus\'s Garden',
      'I Want You (She\'s So Heavy)',
      'Here Comes the Sun',
      'Because',
      'You Never Give Me Your Money',
      'Sun King',
      'Mean Mr. Mustard',
      'Polythene Pam',
      'She Came In Through the Bathroom Window',
      'Golden Slumbers',
      'Carry That Weight',
      'The End',
      'Her Majesty',
    ],
    palette: ['#DCE3EA', '#7C93A4', '#455964', '#2C3A3F', '#111516'],
    coverUrl: 'https://i.scdn.co/image/ab67616d0000b273dc30583ba717007b00cceb25',
    spotifyUri: 'spotify:album:0ETFjACtuP2ADo6LFhL6HN',
  },
};

/**
 * Resolves project root directory
 */
export function getProjectRoot(): string {
  return path.resolve(__dirname, '../../../');
}

/**
 * Dynamically resolves an application or server module, returning null if not yet implemented.
 */
export async function tryImport<T = any>(relativePath: string): Promise<T | null> {
  const fullPath = path.resolve(getProjectRoot(), relativePath);
  const possiblePaths = [
    fullPath,
    fullPath + '.ts',
    fullPath + '.js',
    fullPath + '.mjs',
    fullPath + '/index.ts',
    fullPath + '/index.js',
  ];

  const existing = possiblePaths.find(p => fs.existsSync(p));
  if (!existing) {
    return null;
  }

  try {
    return await import(existing);
  } catch (err) {
    console.warn(`Failed to import module at ${existing}:`, err);
    return null;
  }
}
