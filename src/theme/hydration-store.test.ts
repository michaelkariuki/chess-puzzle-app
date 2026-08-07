import {
  isHydrated,
  isHydratedOnServer,
  markHydrated,
  resetHydrationForTests,
  subscribeToHydration,
} from './hydration-store';

/**
 * Regression cover for the white-flash bug: list rows mounted after a filter
 * change rendered one frame with the light palette before correcting to dark,
 * because the hydration flag was per-component `useState` rather than app-wide.
 *
 * The property that matters is the last test here — a LATE subscriber must see
 * `true` immediately, with no correction pass.
 */
beforeEach(resetHydrationForTests);

describe('hydration store', () => {
  it('starts un-hydrated', () => {
    expect(isHydrated()).toBe(false);
  });

  it('reports false for the server snapshot so first paints agree', () => {
    expect(isHydratedOnServer()).toBe(false);
    markHydrated();
    expect(isHydratedOnServer()).toBe(false);
  });

  it('flips once marked', () => {
    markHydrated();
    expect(isHydrated()).toBe(true);
  });

  it('notifies subscribers exactly once', () => {
    const seen: number[] = [];
    subscribeToHydration(() => seen.push(1));
    markHydrated();
    markHydrated();
    markHydrated();
    expect(seen).toHaveLength(1);
  });

  it('notifies every subscriber', () => {
    let a = 0;
    let b = 0;
    subscribeToHydration(() => (a += 1));
    subscribeToHydration(() => (b += 1));
    markHydrated();
    expect([a, b]).toEqual([1, 1]);
  });

  it('stops notifying after unsubscribe', () => {
    let calls = 0;
    const unsubscribe = subscribeToHydration(() => (calls += 1));
    unsubscribe();
    markHydrated();
    expect(calls).toBe(0);
  });

  /**
   * THE regression test. A component mounting after the app has hydrated —
   * a list row appearing when filters change — must read `true` on its first
   * render. Reading `false` is precisely what produced the white flash.
   */
  it('a component mounting AFTER hydration sees true immediately', () => {
    markHydrated(); // app has been running a while

    // A brand-new row mounts and reads the store for the first time.
    let notified = false;
    subscribeToHydration(() => (notified = true));
    const firstRenderValue = isHydrated();

    expect(firstRenderValue).toBe(true);
    // No correction pass — nothing to notify, so nothing re-renders.
    expect(notified).toBe(false);
  });

  it('is shared, not per-consumer', () => {
    const consumerA = isHydrated();
    markHydrated();
    const consumerB = isHydrated();
    expect(consumerA).toBe(false);
    expect(consumerB).toBe(true);
  });
});
