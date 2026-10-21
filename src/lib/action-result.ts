export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors?: Record<string, string[]>; formError?: string };

export const initialActionResult: ActionResult = { ok: true, data: undefined };
