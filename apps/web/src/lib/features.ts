/**
 * Feature flags, flipped by hand in this file — no remote service, no env
 * plumbing. A flag gates a whole section: its route (via `beforeLoad` in the
 * section's `route.tsx`) and every entry point that links into it.
 *
 * To ship a feature: flip to `true`. To pull it: flip to `false` — the route
 * 404s and the nav entries disappear in the same commit.
 */
export const FEATURES = {
  badminton: true,
  teacherRoom: false,
} as const

export type FeatureKey = keyof typeof FEATURES

/** Path prefix each flag owns, used to filter generated navigation. */
export const FEATURE_PATHS: Record<FeatureKey, string> = {
  badminton: "/badminton",
  teacherRoom: "/teacher-room",
}

export function isFeatureEnabled(key: FeatureKey): boolean {
  return FEATURES[key]
}

/** Path prefixes of every disabled feature — for nav/menu filtering. */
export function disabledFeaturePaths(): Array<string> {
  return (Object.keys(FEATURES) as Array<FeatureKey>)
    .filter((key) => !FEATURES[key])
    .map((key) => FEATURE_PATHS[key])
}
