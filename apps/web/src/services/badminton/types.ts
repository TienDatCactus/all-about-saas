import * as z from "zod";

/**
 * A single participant as entered in the editor. Identity is EITHER a linked app
 * user (`userId`) or a free-text guest name. Percentages are fractions (0..1).
 */
export const ParticipantInputSchema = z.object({
  userId: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required").max(120),
  courtFraction: z.number().min(0).max(1).optional(),
  discount: z.number().min(0).max(1).optional(),
  shuttleCount: z.number().int().min(0).optional(),
});

export type ParticipantInput = z.infer<typeof ParticipantInputSchema>;

export const CreateSessionSchema = z.object({
  playedOn: z.string(), // YYYY-MM-DD
  title: z.string().max(120).optional(),
  courtCost: z.number().int().min(0),
  shuttleUnitPrice: z.number().int().min(0),
  participants: z.array(ParticipantInputSchema).min(1, "Add at least one player"),
});

export type CreateSessionIn = z.infer<typeof CreateSessionSchema>;
export type UpdateSessionIn = Partial<CreateSessionIn>;

// --- Server response shapes (mirror apps/api entities + ComputedSnapshot) ---

export interface ComputedRow {
  participantId: string;
  name: string;
  court: number;
  shuttle: number;
  total: number;
}

export interface ComputedSnapshot {
  courtCost: number;
  shuttleCost: number;
  grandTotal: number;
  rows: ComputedRow[];
  roundingResidual: number;
  computedAt: string;
}

export interface SessionParticipant {
  id: string;
  userId?: string | null;
  name: string;
  courtFraction: number;
  discount: number;
  shuttleCount: number;
}

export interface BadmintonSession {
  id: string;
  ownerId: string;
  playedOn: string;
  title?: string | null;
  courtCost: number;
  shuttleUnitPrice: number;
  shareToken: string;
  computed?: ComputedSnapshot | null;
  participants?: SessionParticipant[];
  createdAt: string;
  updatedAt: string;
}

/** PII-safe read of a session via its public share token. */
export interface PublicSession {
  title?: string | null;
  playedOn: string;
  courtCost: number;
  shuttleUnitPrice: number;
  participants: Array<Omit<SessionParticipant, "userId">>;
  computed?: ComputedSnapshot | null;
}

export interface ParticipantSuggestion {
  users: Array<{ userId: string; name: string; email: string }>;
  guests: string[];
}
