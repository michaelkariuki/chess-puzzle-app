/**
 * App-wide "has the client hydrated yet?" flag.
 *
 * Static web rendering can't know the user's colour scheme, so the first paint
 * must assume a default and correct itself once the client takes over. The
 * template did that with a per-component `useState(false)` — which means EVERY
 * component that reads the theme repeats the correction, not just the first
 * render of the app.
 *
 * The visible consequence: any component mounted after startup (a list row
 * appearing when a filter changes) renders one frame with the light palette —
 * a white flash — before flipping to dark.
 *
 * Hydration is a property of the app, not of a component, so the flag lives at
 * module scope. Components mounting after hydration read `true` on their very
 * first render and never flash.
 */

let hydrated = false;
const subscribers = new Set<() => void>();

export function subscribeToHydration(onChange: () => void): () => void {
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
  };
}

export function isHydrated(): boolean {
  return hydrated;
}

/** Always false, so server and first client render agree. */
export function isHydratedOnServer(): boolean {
  return false;
}

/** Idempotent — the first component to mount flips it for everyone. */
export function markHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  for (const notify of subscribers) notify();
}

/** Test-only: restore the pre-hydration state. */
export function resetHydrationForTests(): void {
  hydrated = false;
  subscribers.clear();
}
