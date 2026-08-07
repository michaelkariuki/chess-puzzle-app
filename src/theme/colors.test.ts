import { AppTheme, contrastRatio, luminance, TEXT_ON_SURFACE, type AppColors } from './colors';

/**
 * The dark-mode bug this suite exists to prevent: text drawn near-black on a
 * dark surface, which is invisible to typecheck, lint and every unit test but
 * completely unreadable on screen. Contrast is a computable property, so it
 * gets asserted rather than eyeballed.
 */

/** WCAG AA for normal-size body text. */
const AA_NORMAL = 4.5;
/** WCAG AA for large/bold text — banner titles and stat values. */
const AA_LARGE = 3;

describe('luminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(luminance('#000000')).toBeCloseTo(0);
    expect(luminance('#FFFFFF')).toBeCloseTo(1);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('is 1 for a colour against itself', () => {
    expect(contrastRatio('#5E8C3E', '#5E8C3E')).toBeCloseTo(1);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#FEDCBA')).toBeCloseTo(
      contrastRatio('#FEDCBA', '#123456'),
    );
  });

  /** Guards the test itself: the old hardcoded pairing must be caught. */
  it('flags the original bug — #1a1a1a on the dark surface', () => {
    expect(contrastRatio('#1a1a1a', AppTheme.dark.surface)).toBeLessThan(AA_NORMAL);
  });
});

describe.each(['light', 'dark'] as const)('%s scheme', (scheme) => {
  const colors = AppTheme[scheme];

  it.each(TEXT_ON_SURFACE)('%s on %s meets AA', (textKey, surfaceKey) => {
    const ratio = contrastRatio(colors[textKey], colors[surfaceKey]);
    expect(ratio).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('body text meets full AA on both surfaces', () => {
    expect(contrastRatio(colors.text, colors.background)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrastRatio(colors.text, colors.surface)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('muted text stays readable', () => {
    expect(contrastRatio(colors.textMuted, colors.background)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('board squares are distinguishable from each other', () => {
    expect(contrastRatio(colors.boardLight, colors.boardDark)).toBeGreaterThan(1.5);
  });

  it('defines every token', () => {
    const required: (keyof AppColors)[] = [
      'background', 'surface', 'surfaceStrong', 'border',
      'text', 'textMuted', 'textOnAccent',
      'accent', 'accentPressed',
      'success', 'successSurface', 'danger', 'dangerSurface',
      'warning', 'warningSurface',
      'boardLight', 'boardDark', 'boardCoord',
    ];
    for (const key of required) {
      expect(colors[key]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
