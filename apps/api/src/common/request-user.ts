import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * `req.user` — whatever the passport strategy that authenticated the request
 * handed back.
 *
 * `@types/passport` declares `Express.User` as an empty interface and leaves it
 * to the application to say what is really there, which is why `req.user.id`
 * used to only work because `req` itself was an implicit `any`.
 *
 * Two different shapes land here, so only their common, actually-read fields are
 * declared:
 *   - {@link JwtStrategy} on every authenticated route → `id` is the app's user
 *     id and `email` is always present.
 *   - the OAuth strategies, on the provider callback routes only → `id` is the
 *     *provider's* user id and `email` is NOT guaranteed: Facebook accounts
 *     registered by phone number and GitHub accounts with a private address both
 *     complete the flow without releasing one.
 *
 * The provider profiles carry more than this (display name, avatar, …). Those
 * fields are persisted verbatim into `OAuthAccount.profileData` and never read
 * by name, so they are deliberately left undeclared rather than typed as a lie.
 */
declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		interface User {
			id: string;
			email?: string;
			/**
			 * The provider's access token, present on OAuth logins. Stripped before
			 * the rest of the profile is stored.
			 */
			accessToken?: string;
		}
	}
}

/** Alias for the augmented `Express.User`, so app code needn't reach into the namespace. */
export type RequestUser = Express.User;

/**
 * The authenticated user of a request, or a 401.
 *
 * `JwtAuthGuard` is registered globally (default-deny), so on any route without
 * `@Public()` this is always populated — but "always" is an invariant of the
 * guard wiring, not something the type system can see, and the alternative is a
 * `!` that turns a wiring mistake into `Cannot read properties of undefined`
 * inside a service. A 401 is the correct answer to an unauthenticated request.
 */
export function requireUser(req: Request): RequestUser {
	const user = req.user;
	if (!user?.id) {
		throw new UnauthorizedException('Not authenticated');
	}
	return user;
}
