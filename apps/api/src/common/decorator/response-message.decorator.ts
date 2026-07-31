import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'response:message';

/**
 * Sets the `message` on the response envelope without putting it in the handler's
 * return value.
 *
 * The alternative — returning `{ message, ...data }` — worked only because
 * TransformInterceptor lifted any top-level `message` out of the payload, which
 * also meant a resource that legitimately *has* a `message` field silently lost
 * it. Declaring the text here keeps the handler returning data and only data.
 */
export const ResponseMessage = (message: string) =>
	SetMetadata(RESPONSE_MESSAGE_KEY, message);
