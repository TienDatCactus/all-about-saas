import { AppConstants } from "./constants"
import { storage } from "./local-storage"

/**
 * The access token lives HERE — a module-scope variable — and nowhere else.
 *
 * It used to live in localStorage, which any script that achieves XSS can read
 * with one synchronous call, from any tab, at any later time. Memory narrows
 * that to "code running in this document, while it runs", and the CSP's
 * connect-src (see Caddyfile) means even that code has nowhere to send it.
 *
 * The deliberate cost: a page reload forgets the token. That is fine by
 * design — the first API call 401s, the http client's interceptor exchanges
 * the httpOnly refresh cookie for a new access token and retries the original
 * request. The refresh cookie is the durable credential; this value is a
 * 15-minute convenience.
 */

/**
 * This app server-renders, so this module is also evaluated on the server —
 * where a module-scope variable is shared by EVERY concurrent request. Storing
 * one visitor's token there would hand it to the next visitor's render.
 *
 * Nothing does that today (no route uses `loader`/`beforeLoad`/`createServerFn`,
 * so every API call happens in the browser), but the day someone adds a
 * server-side loader that hits an authenticated endpoint, the failure would be
 * a silent cross-user token leak — the worst possible thing to discover late.
 * So the store simply refuses to hold anything on the server: reads are always
 * undefined, writes warn and drop.
 *
 * If SSR ever genuinely needs an authenticated fetch, it must read the incoming
 * request's own cookie — per-request state — not this module.
 */
const isBrowser = () => typeof window !== "undefined"

let accessToken: string | undefined

export const getAccessToken = () => (isBrowser() ? accessToken : undefined)

export const setAccessToken = (token: string) => {
  if (!isBrowser()) {
    console.warn(
      "[auth] Refusing to store an access token during SSR: module scope is " +
        "shared across requests, so this would leak between users. Authenticated " +
        "server-side fetches must use the incoming request's cookie."
    )
    return
  }
  accessToken = token
}

export const clearAccessToken = () => {
  accessToken = undefined
}

// One-time migration: users who logged in before this change still have a
// token sitting in localStorage. It is no longer read, but "no longer read"
// is not "gone" — purge it so an XSS tomorrow cannot harvest a leftover from
// last week. Browser-only; `storage` no-ops on the server anyway, but calling
// it explicitly here documents that this is a browser-side cleanup.
if (isBrowser()) {
  storage.remove(AppConstants.tokenKey)
}
