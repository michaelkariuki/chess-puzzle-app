/**
 * Semantic colour tokens for the app.
 *
 * The template's `constants/theme.ts` covers only text/background/tint, which
 * is why the first pass reached for hardcoded hex values in the puzzle screen
 * — and those rendered near-black on a dark background. Every colour that
 * appears on screen belongs here, defined for both schemes.
 *
 * Contrast: text tokens are checked against their own surface in
 * `colors.test.ts`, so a token added without a dark-mode value fails the build
 * rather than shipping an unreadable label.
 */

export interface AppColors {
  /** Page background. */
  background: string;
  /** Raised surface: cards, banners, stat tiles. */
  surface: string;
  /** Slightly stronger surface for pressed/secondary controls. */
  surfaceStrong: string;
  border: string;

  text: string;
  textMuted: string;
  /** Text on top of an accent-filled control. */
  textOnAccent: string;

  accent: string;
  accentPressed: string;

  success: string;
  successSurface: string;
  danger: string;
  dangerSurface: string;
  warning: string;
  warningSurface: string;

  /** Board squares. */
  boardLight: string;
  boardDark: string;
  boardCoord: string;
}

export const AppTheme: Record<'light' | 'dark', AppColors> = {
  light: {
    background: '#FFFFFF',
    surface: '#F1F3F0',
    surfaceStrong: '#E3E7E0',
    border: '#D8DCD6',

    text: '#14181B',
    textMuted: '#5C6670',
    textOnAccent: '#FFFFFF',

    accent: '#5E8C3E',
    accentPressed: '#4C7331',

    success: '#1E6F35',
    successSurface: '#DCF0E0',
    danger: '#B3261E',
    dangerSurface: '#FBE3E1',
    warning: '#8A6100',
    warningSurface: '#FCF0D6',

    boardLight: '#EBECD0',
    boardDark: '#779556',
    boardCoord: '#5C6670',
  },
  dark: {
    background: '#121416',
    surface: '#1E2226',
    surfaceStrong: '#2A3036',
    border: '#333A41',

    // Deliberately high-contrast: this is the pairing the first version got
    // wrong by leaving text near-black on a dark surface.
    text: '#EDEFF1',
    textMuted: '#A6AFB8',
    // Dark, not white: the dark-scheme accent is a LIGHT green, so white text
    // on it lands at 2.2:1. The inversion is easy to miss by eye — the
    // contrast test is what caught it.
    textOnAccent: '#14181B',

    accent: '#8CBF63',
    accentPressed: '#7BAA55',

    success: '#7FD69A',
    successSurface: '#1B3524',
    danger: '#F2A9A3',
    dangerSurface: '#3B1F1D',
    warning: '#F0CE7C',
    warningSurface: '#382E14',

    boardLight: '#D8D9BE',
    boardDark: '#6B8850',
    boardCoord: '#A6AFB8',
  },
};

/** Text tokens paired with the surface they are drawn on, for contrast tests. */
export const TEXT_ON_SURFACE: [keyof AppColors, keyof AppColors][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['textOnAccent', 'accent'],
  ['success', 'successSurface'],
  ['danger', 'dangerSurface'],
  ['warning', 'warningSurface'],
  ['boardCoord', 'background'],
];

/** Relative luminance per WCAG 2.1. */
export function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** WCAG contrast ratio between two hex colours, 1:1 to 21:1. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
