/**
 * A page loaded before an update tries to load a piece of the new version and crashes
 * ("e[o] is not a function", "Loading chunk 123 failed", a missing server action). A fresh
 * load fixes it, so the error screens reload once by themselves (at most once a minute).
 */
const STALE = /is not a function|ChunkLoadError|Loading (CSS )?chunk|Failed to fetch dynamically imported module|Failed to find Server Action|was not found on the server|Importing a module script failed/i;

export function isStaleAppError(message: string): boolean {
  return STALE.test(message);
}

/** Reloads the page once (returns true if it is reloading). */
export function reloadOnceForUpdate(): boolean {
  try {
    const last = Number(sessionStorage.getItem("surfdesk:update-reload") ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem("surfdesk:update-reload", String(Date.now()));
  } catch {
    // No storage (private mode): still reload once; the next error shows the screen.
  }
  window.location.reload();
  return true;
}
