import * as z from "zod"

export const PaymentMethodSchema = z.object({
  id: z.string(),
  type: z.enum(["image", "phone"]),
  label: z.string(),
  imageUrl: z.string().nullish(),
  phoneNumber: z.string().nullish(),
  createdAt: z.string(),
})

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>

export const CreatePaymentMethodSchema = z.object({
  type: z.enum(["image", "phone"]),
  label: z.string().min(1).max(120),
  phoneNumber: z.string().max(20).optional(),
  file: z.instanceof(File).optional(),
})

export type CreatePaymentMethodIn = z.infer<typeof CreatePaymentMethodSchema>

export const DeletedIdSchema = z.object({ id: z.string() })

/** The PII-safe shape embedded in a public share-page response — no id, no owner info. */
export const PublicPaymentMethodSchema = z.object({
  type: z.enum(["image", "phone"]),
  label: z.string(),
  imageUrl: z.string().nullish(),
  phoneNumber: z.string().nullish(),
})

export type PublicPaymentMethod = z.infer<typeof PublicPaymentMethodSchema>
