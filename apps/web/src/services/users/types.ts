/** GET /users/me — the caller's own record, id taken from the JWT. */

import z from "zod"

export const MeSchema = z.looseObject({
  id: z.string().min(1),
  email: z.string().min(1),
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  role: z.object({ name: z.string().optional() }).nullable().optional(),
})

export type Me = z.infer<typeof MeSchema>
