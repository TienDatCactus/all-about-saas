import * as z from "zod"

/**
 * Validates an API response against the shape the caller claims it has.
 *
 * The http client returns `get<T>() as unknown as Promise<T>` — `T` is an
 * assertion, not a check. When the API's shape drifts, nothing notices at the
 * boundary; the mismatch surfaces later as `undefined is not an object` inside a
 * render, several frames from the cause. zod already guards every *input* in this
 * app, and responses are the same class of untrusted data.
 *
 * Additive changes stay safe: zod strips unknown keys, so a new field on the API
 * cannot break an older client. Only a missing or wrong-typed field fails — which
 * is a genuine contract break, and one worth hearing about at the fetch rather
 * than three components deep.
 */
export class ResponseContractError extends Error {
  constructor(
    readonly endpoint: string,
    readonly issues: z.ZodError["issues"]
  ) {
    const detail = issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ")
    super(`${endpoint} returned an unexpected shape — ${detail}`)
    this.name = "ResponseContractError"
  }
}

export async function parseResponse<S extends z.ZodType>(
  endpoint: string,
  schema: S,
  response: Promise<unknown>
): Promise<z.infer<S>> {
  const result = schema.safeParse(await response)
  if (result.success) {
    return result.data
  }
  // Logged as well as thrown: the throw reaches the UI as a generic error state,
  // while this line keeps the field-level detail in the console where it is
  // actually actionable.
  console.error(`[api] ${endpoint} failed response validation`, result.error)
  throw new ResponseContractError(endpoint, result.error.issues)
}

/** `BaseService.paginate()`'s envelope, around any item schema. */
export const paginatedSchema = <S extends z.ZodType>(item: S) =>
  z.object({
    data: z.array(item),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    pages: z.number(),
  })
