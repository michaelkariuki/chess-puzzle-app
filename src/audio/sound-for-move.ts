/**
 * Which sound a board event should make.
 *
 * Pure and framework-free on purpose — this is the part with actual decisions
 * in it (a capture beats a plain move, check beats both, a solve beats
 * everything), so it belongs where it can be unit-tested without an audio
 * device.
 */

export type SoundName =
  | 'move'
  | 'capture'
  | 'check'
  | 'correct'
  | 'solved'
  | 'wrong'
  | 'failed';

export interface MoveOutcome {
  /** Did the move take a piece? */
  captured: boolean;
  /** Does the resulting position have the opponent in check? */
  check: boolean;
  /** Terminal state of the puzzle after this move, if any. */
  status: 'solved' | 'failed' | 'wrong' | 'continuing';
  /** True when this was the opponent's automatic reply, not the player's move. */
  byOpponent: boolean;
}

/**
 * Priority, highest first:
 *   1. terminal puzzle states — the outcome matters more than the move
 *   2. check — the most important thing about a position
 *   3. capture — more consequential than a quiet move
 *   4. plain move
 *
 * The player's own correct-but-not-final move gets `correct` only when it was
 * quiet; a capture or check is more informative, so those win.
 */
export function soundForMove(outcome: MoveOutcome): SoundName {
  if (outcome.status === 'solved') return 'solved';
  if (outcome.status === 'failed') return 'failed';
  if (outcome.status === 'wrong') return 'wrong';

  if (outcome.check) return 'check';
  if (outcome.captured) return 'capture';

  // A quiet correct move by the player gets its own affirmative tick; the
  // opponent's quiet reply is just a move.
  return outcome.byOpponent ? 'move' : 'correct';
}
