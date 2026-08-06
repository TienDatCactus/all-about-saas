import * as z from "zod";

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
    readonly issues: z.ZodError["issues"],
  ) {
    const detail = issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    super(`${endpoint} returned an unexpected shape — ${detail}`);
    this.name = "ResponseContractError";
  }
}

export async function parseResponse<TSchema extends z.ZodType>(
  endpoint: string,
  schema: TSchema,
  response: Promise<unknown>,
): Promise<z.infer<TSchema>> {
  const result = schema.safeParse(await response);
  if (result.success) {
    return result.data;
  }
  throw new ResponseContractError(endpoint, result.error.issues);
}

/** `BaseService.paginate()`'s envelope, around any item schema. */
export const paginatedSchema = <TSchema extends z.ZodType>(item: TSchema) =>
  z.object({
    data: z.array(item),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    pages: z.number(),
  });
