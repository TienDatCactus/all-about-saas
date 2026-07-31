import * as z from "zod"

export type { ComputedRow, ComputedSnapshot } from "@repo/badminton-calc"
import type { ComputedSnapshot } from "@repo/badminton-calc"

export const ParticipantInputSchema = z.object({
  userId: z.uuid().optional(),
  name: z.string().min(1, "Name is required").max(120),
  courtFraction: z.number().min(0).max(1).optional(),
  discount: z.number().min(0).max(1).optional(),
  shuttleFraction: z.number().min(0).max(1).optional(),
})

export type ParticipantInput = z.infer<typeof ParticipantInputSchema>

export const CreateSessionSchema = z.object({
  playedOn: z.string(), // YYYY-MM-DD
  title: z.string().max(120).optional(),
  courtCost: z.number().int().min(0),
  shuttleUnitPrice: z.number().int().min(0),
  totalShuttleCount: z.number().int().min(0),
  participants: z
    .array(ParticipantInputSchema)
    .min(1, "Add at least one player"),
})

export type CreateSessionIn = z.infer<typeof CreateSessionSchema>
export type UpdateSessionIn = Partial<CreateSessionIn>

/** Envelope returned by the API's BaseService.paginate(). */
export interface SessionParticipant {
  id: string
  userId?: string | null
  name: string
  courtFraction: number
  discount: number
  shuttleFraction: number
}

export interface BadmintonSession {
  id: string
  ownerId: string
  playedOn: string
  title?: string | null
  courtCost: number
  shuttleUnitPrice: number
  totalShuttleCount: number
  shareToken: string
  computed?: ComputedSnapshot | null
  participants?: SessionParticipant[]
  createdAt: string
  updatedAt: string
}

/** PII-safe read of a session via its public share token. */
export interface PublicSession {
  title?: string | null
  playedOn: string
  courtCost: number
  shuttleUnitPrice: number
  totalShuttleCount: number
  participants: Array<Omit<SessionParticipant, "userId">>
  computed?: ComputedSnapshot | null
}

export interface ParticipantSuggestion {
  users: Array<{ userId: string; name: string }>
  /**
   * Free-text names this organizer has used before. Optional because the API
   * currently omits the guest query — reading it unguarded would throw.
   */
  guests?: string[]
}
