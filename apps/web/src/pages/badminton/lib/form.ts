import { computeSplit } from "@repo/badminton-calc"
import type {
  BadmintonSession,
  CreateSessionIn,
} from "@/services/badminton/types"

/** A player as edited in the form. Percentages are 0..100 (converted to 0..1 on save). */
export interface EditorPlayer {
  id: string
  userId?: string
  name: string
  courtPercent: number
  discountPercent: number
  /** Weight for the shared shuttle pot, 0..100 (converted to a 0..1 fraction on save). */
  shuttlePercent: number
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

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const wholeShuttles = (n: unknown) => Math.max(0, Math.trunc(Number(n)) || 0)
export const todayIso = () => new Date().toISOString().slice(0, 10)

/** Random-keyed player for client-side adds (after mount). */
export function newPlayer(name = ""): EditorPlayer {
  return {
    id: uid(),
    name,
    courtPercent: 100,
    discountPercent: 0,
    shuttlePercent: 100,
  }
}

/** Deterministic-keyed player for the initial render, so SSR and client match. */
function seedPlayer(index: number): EditorPlayer {
  return {
    id: `seed-${index}`,
    name: "",
    courtPercent: 100,
    discountPercent: 0,
    shuttlePercent: 100,
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
      courtPercent: Math.round(p.courtFraction * 100),
      discountPercent: Math.round(p.discount * 100),
      shuttlePercent: Math.round(p.shuttleFraction * 100),
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
      courtFraction: clamp01((p.courtPercent || 0) / 100),
      discount: clamp01((p.discountPercent || 0) / 100),
      shuttleFraction: clamp01((p.shuttlePercent || 0) / 100),
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
    participants: v.players.reduce<any>((acc, p) => {
      const name = p.name.trim()

      if (!name) return acc

      acc.push({
        userId: p.userId,
        name: name || "Unnamed",
        courtFraction: clamp01(p.courtPercent / 100),
        discount: clamp01(p.discountPercent / 100),
        shuttleFraction: clamp01(p.shuttlePercent / 100),
      })

      return acc
    }, []),
  }
}

export function hasNamedPlayer(v: EditorValues): boolean {
  return v.players.some((p) => p.name.trim().length > 0)
}
