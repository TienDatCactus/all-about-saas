import type { LoadingBarRef } from "react-top-loading-bar"

// Bridge between React and non-React code: the bar lives in __root.tsx and
// registers itself here via callback ref; the axios interceptors in http.ts
// (module code, no access to hooks) drive it through the track* functions.
// The pending counter collapses concurrent requests into one bar cycle —
// start on 0→1, complete on 1→0 — so parallel requests don't flicker it.

let bar: LoadingBarRef | null = null
let pending = 0

export function registerLoadingBar(ref: LoadingBarRef | null) {
  bar = ref
}

// The document guard makes these no-ops during SSR: there is no bar on the
// server, and module state is shared across requests there, so counting
// would only let `pending` drift.
export function trackRequestStart() {
  if (typeof document === "undefined") return
  pending += 1
  if (pending === 1) bar?.continuousStart()
}

export function trackRequestEnd() {
  if (typeof document === "undefined") return
  pending = Math.max(0, pending - 1)
  if (pending === 0) bar?.complete()
}
