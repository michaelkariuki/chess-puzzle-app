import { soundForMove, type MoveOutcome } from './sound-for-move';

const outcome = (over: Partial<MoveOutcome> = {}): MoveOutcome => ({
  captured: false,
  check: false,
  status: 'continuing',
  byOpponent: false,
  ...over,
});

describe('soundForMove', () => {
  it('plays the solve fanfare when the puzzle is finished', () => {
    expect(soundForMove(outcome({ status: 'solved' }))).toBe('solved');
  });

  it('plays the failure sound when the puzzle is lost', () => {
    expect(soundForMove(outcome({ status: 'failed' }))).toBe('failed');
  });

  it('plays the buzz on a wrong move', () => {
    expect(soundForMove(outcome({ status: 'wrong' }))).toBe('wrong');
  });

  /** The outcome of the puzzle matters more than the mechanics of the move. */
  it('lets a terminal status win over check and capture', () => {
    expect(soundForMove(outcome({ status: 'solved', check: true, captured: true }))).toBe(
      'solved',
    );
    expect(soundForMove(outcome({ status: 'failed', captured: true }))).toBe('failed');
    expect(soundForMove(outcome({ status: 'wrong', check: true }))).toBe('wrong');
  });

  it('prefers check over capture', () => {
    expect(soundForMove(outcome({ check: true, captured: true }))).toBe('check');
  });

  it('plays capture for a quiet take', () => {
    expect(soundForMove(outcome({ captured: true }))).toBe('capture');
  });

  it('gives the player an affirmative tick for a quiet correct move', () => {
    expect(soundForMove(outcome())).toBe('correct');
  });

  it("plays a plain move for the opponent's quiet reply", () => {
    expect(soundForMove(outcome({ byOpponent: true }))).toBe('move');
  });

  it("still plays capture and check for the opponent's reply", () => {
    expect(soundForMove(outcome({ byOpponent: true, captured: true }))).toBe('capture');
    expect(soundForMove(outcome({ byOpponent: true, check: true }))).toBe('check');
  });

  it('always returns a known sound name', () => {
    const names = new Set([
      'move', 'capture', 'check', 'correct', 'solved', 'wrong', 'failed',
    ]);
    for (const status of ['solved', 'failed', 'wrong', 'continuing'] as const) {
      for (const captured of [true, false]) {
        for (const check of [true, false]) {
          for (const byOpponent of [true, false]) {
            expect(names.has(soundForMove({ status, captured, check, byOpponent }))).toBe(
              true,
            );
          }
        }
      }
    }
  });
});
