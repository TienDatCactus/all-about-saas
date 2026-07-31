import * as z from "zod"
import type { ComputedSnapshot } from "@repo/badminton-calc"

export type { ComputedRow, ComputedSnapshot } from "@repo/badminton-calc"

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Responses
//
// These were hand-written interfaces mirroring the API by eye, never checked
// against it — which is how the list type came to promise `ownerId`, `shareToken`
// and `updatedAt` that the list endpoint does not select. As schemas they are the
// type (via z.infer) *and* the runtime check, so the two cannot disagree.
//
// Types always derive from the schema directly above them, never the reverse.
// ---------------------------------------------------------------------------

const ComputedRowSchema = z.object({
  participantId: z.string(),
  name: z.string(),
  court: z.number(),
  shuttle: z.number(),
  total: z.number(),
})

const ComputedSnapshotSchema = z.object({
  courtCost: z.number(),
  shuttleCost: z.number(),
  grandTotal: z.number(),
  rows: z.array(ComputedRowSchema),
  roundingResidual: z.number(),
  computedAt: z.string(),
})

/**
 * Compile-time proof that the schema still describes the shared package's
 * `ComputedSnapshot` — the API writes this object with `computeSplit` from that
 * same package, so a field added on one side and not the other is a real drift.
 * Change either and one of these two assignments stops type-checking.
 *
 * Type-level only; nothing here exists at runtime.
 */
type AssertAssignable<A extends B, B> = [A, B]
export type SnapshotMatchesPackage = [
  AssertAssignable<z.infer<typeof ComputedSnapshotSchema>, ComputedSnapshot>,
  AssertAssignable<ComputedSnapshot, z.infer<typeof ComputedSnapshotSchema>>,
]

export const SessionParticipantSchema = z.object({
  id: z.string(),
  // Guests have no account and the column is nullable, so JSON carries null.
  userId: z.string().nullish(),
  name: z.string(),
  courtFraction: z.number(),
  discount: z.number(),
  shuttleFraction: z.number(),
})

export type SessionParticipant = z.infer<typeof SessionParticipantSchema>

/** A full session: what GET/POST/PATCH of a single session return. */
export const BadmintonSessionSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  playedOn: z.string(),
  title: z.string().nullish(),
  courtCost: z.number(),
  shuttleUnitPrice: z.number(),
  totalShuttleCount: z.number(),
  shareToken: z.string(),
  computed: ComputedSnapshotSchema.nullish(),
  participants: z.array(SessionParticipantSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type BadmintonSession = z.infer<typeof BadmintonSessionSchema>

/**
 * A row from `GET /badminton/sessions`, which selects a deliberate subset: no
 * `ownerId`, `shareToken` or `updatedAt`, and participants reduced to their ids
 * because the page only counts them. Its own type on purpose — typing the list as
 * `BadmintonSession` promised fields that were never on the wire.
 */
export const SessionListItemSchema = z.object({
  id: z.string(),
  playedOn: z.string(),
  title: z.string().nullish(),
  courtCost: z.number(),
  shuttleUnitPrice: z.number(),
  totalShuttleCount: z.number(),
  computed: ComputedSnapshotSchema.nullish(),
  participants: z.array(z.object({ id: z.string() })).optional(),
  createdAt: z.string(),
})

export type SessionListItem = z.infer<typeof SessionListItemSchema>

/** PII-safe read of a session via its public share token. */
export const PublicSessionSchema = z.object({
  title: z.string().nullish(),
  playedOn: z.string(),
  courtCost: z.number(),
  shuttleUnitPrice: z.number(),
  totalShuttleCount: z.number(),
  participants: z.array(SessionParticipantSchema.omit({ userId: true })),
  computed: ComputedSnapshotSchema.nullish(),
})

export type PublicSession = z.infer<typeof PublicSessionSchema>

export const ParticipantSuggestionSchema = z.object({
  users: z.array(
    z.object({
      userId: z.string(),
      /**
       * Nullish rather than required. The API resolves this as
       * `profile.displayName ?? email`, but its query selects only
       * `u.id, profile.displayName` — `email` is never loaded, so a user with no
       * display name comes back with no name at all. Declaring that honestly
       * stops the autocomplete rendering `undefined`; the query is a separate fix
       * on the API side.
       */
      name: z.string().nullish(),
      email: z.string().nullish(),
    })
  ),
  /** Free-text names this organizer has used before; the API omits that query today. */
  guests: z.array(z.string()).optional(),
})

export type ParticipantSuggestion = z.infer<typeof ParticipantSuggestionSchema>

export const DeletedIdSchema = z.object({ id: z.string() })
