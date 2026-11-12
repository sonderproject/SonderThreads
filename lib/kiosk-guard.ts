import { AsyncLocalStorage } from "node:async_hooks";

/**
 * A kiosk tablet stays signed in as a staff member. So that someone at the
 * front desk can't call the app's other server actions (search, exports,
 * edits) from the browser's developer tools, only the kiosk's own actions
 * run while the kiosk cookie is set: they wrap their work in runAsKiosk(),
 * and requireUserId() refuses every other server action on that device.
 */
const kioskAction = new AsyncLocalStorage<true>();

export function runAsKiosk<T>(fn: () => Promise<T>): Promise<T> {
  return kioskAction.run(true, fn);
}

export function inKioskAction(): boolean {
  return kioskAction.getStore() === true;
}
