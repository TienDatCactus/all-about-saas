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
let accessToken: string | undefined

export const getAccessToken = () => accessToken

export const setAccessToken = (token: string) => {
  accessToken = token
}

export const clearAccessToken = () => {
  accessToken = undefined
}

// One-time migration: users who logged in before this change still have a
// token sitting in localStorage. It is no longer read, but "no longer read"
// is not "gone" — purge it so an XSS tomorrow cannot harvest a leftover from
// last week. Runs on module load; removing an absent key is a no-op.
storage.remove(AppConstants.tokenKey)
