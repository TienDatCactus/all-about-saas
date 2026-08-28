import { computeSplit } from "@repo/badminton-calc"
import type {
  BadmintonSession,
  CreateSessionIn,
  ParticipantInput,
} from "@/services/badminton/types"

/** A player as edited in the form. hoursPlayed/shuttleWeight are raw units, not percentages. */
export interface EditorPlayer {
  id: string
  userId?: string
  name: string
  hoursPlayed: number
  shuttleWeight: number
  gender?: "male" | "female"
}

export interface EditorValues {
  title: string
  playedOn: string
  courtCost: number
  shuttleUnitPrice: number
  totalShuttleCount: number
  players: Array<EditorPlayer>
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

/**
 * `EditorPlayer.id` does double duty: for a loaded session it is the real
 * participant id, but for a row added in the browser it is only a React key —
 * `seed-0`/`seed-1` on the first render, and `uid()`'s `Math.random()` fallback
 * on a browser without `crypto.randomUUID`.
 *
 * Only the UUID-shaped ones may go out on the wire. The API validates
 * `participants[].id` with `@IsUUID()`, so sending `seed-0` would reject the
 * entire save; and a client-minted UUID is harmless because the API only reuses
 * an id that already names a row in this session, generating its own otherwise.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const persistedId = (id: string) => (UUID_RE.test(id) ? id : undefined)

const nonNegative = (n: number) => Math.max(0, n || 0)
const wholeShuttles = (n: unknown) => Math.max(0, Math.trunc(Number(n)) || 0)
export const todayIso = () => new Date().toISOString().slice(0, 10)

/**
 * Starting weight before a gender is picked, on the 0-10 scale (10 = 100%).
 * Set to the nam-equivalent (6), not a neutral value — most sessions are
 * majority-male, so a new row only needs touching when it's actually nữ.
 */
export const DEFAULT_SHUTTLE_WEIGHT = 6

/** nam:6 / nữ:4 out of 10, per docs/badminton-splitter-spec.md §3. Only called once a gender is picked — see PlayerRow.tsx. */
export function defaultShuttleWeight(gender: "male" | "female"): number {
  return gender === "male" ? DEFAULT_SHUTTLE_WEIGHT : 4
}

/** Random-keyed player for client-side adds (after mount). */
export function newPlayer(name = ""): EditorPlayer {
  return {
    id: uid(),
    name,
    hoursPlayed: 1,
    shuttleWeight: DEFAULT_SHUTTLE_WEIGHT,
  }
}

/** Deterministic-keyed player for the initial render, so SSR and client match. */
function seedPlayer(index: number): EditorPlayer {
  return {
    id: `seed-${index}`,
    name: "",
    hoursPlayed: 1,
    shuttleWeight: DEFAULT_SHUTTLE_WEIGHT,
  }
}

export function defaultValues(): EditorValues {
  return {
    title: "",
    playedOn: todayIso(),
    courtCost: 0,
    shuttleUnitPrice: 0,
    totalShuttleCount: 0,
    players: [seedPlayer(0), seedPlayer(1)],
  }
}

export function sessionToValues(s: BadmintonSession): EditorValues {
  return {
    title: s.title ?? "",
    playedOn: s.playedOn,
    courtCost: s.courtCost,
    shuttleUnitPrice: s.shuttleUnitPrice,
    totalShuttleCount: s.totalShuttleCount,
    players: (s.participants ?? []).map((p) => ({
      id: p.id,
      userId: p.userId ?? undefined,
      name: p.name,
      hoursPlayed: p.hoursPlayed,
      shuttleWeight: p.shuttleWeight,
      gender: p.gender ?? undefined,
    })),
  }
}

export function valuesToComputed(v: EditorValues) {
  return computeSplit({
    courtCost: v.courtCost || 0,
    shuttleUnitPrice: v.shuttleUnitPrice || 0,
    totalShuttleCount: wholeShuttles(v.totalShuttleCount),
    participants: v.players.map((p) => ({
      id: p.id,
      name: p.name.trim() || "Unnamed",
      hoursPlayed: nonNegative(p.hoursPlayed),
      shuttleWeight: nonNegative(p.shuttleWeight),
    })),
  })
}

export function valuesToPayload(v: EditorValues): CreateSessionIn {
  return {
    playedOn: v.playedOn,
    title: v.title.trim() || undefined,
    courtCost: v.courtCost,
    shuttleUnitPrice: v.shuttleUnitPrice,
    totalShuttleCount: wholeShuttles(v.totalShuttleCount),
    participants: v.players.reduce<ParticipantInput[]>((acc, p) => {
      const name = p.name.trim()

      if (!name) return acc

      acc.push({
        // Without this the API saw every row as new on each save, deleted the
        // stored ones and reinserted them unpaid — so "Save changes" wiped
        // every participant's paid status.
        id: persistedId(p.id),
        userId: p.userId,
        name: name || "Unnamed",
        hoursPlayed: nonNegative(p.hoursPlayed),
        shuttleWeight: nonNegative(p.shuttleWeight),
        gender: p.gender,
      })

      return acc
    }, []),
  }
}

export function hasNamedPlayer(v: EditorValues): boolean {
  return v.players.some((p) => p.name.trim().length > 0)
}
