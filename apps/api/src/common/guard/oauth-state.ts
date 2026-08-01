import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { IAuthModuleOptions } from '@nestjs/passport';
import { randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import configuration from '../config/configuration';

/**
 * OAuth `state` (login-CSRF) protection, double-submit cookie style.
 *
 * Without it, an attacker can start an OAuth flow with *their* provider account
 * and trick a victim's browser into completing the callback, silently binding the
 * victim's session to the attacker's identity — or, in the reverse direction,
 * link their own provider account to the victim's logged-in account.
 *
 * passport's built-in `state: true` keeps the value in `req.session`, which would
 * mean bolting express-session plus a shared store onto an otherwise stateless
 * JWT API. Passing `state` explicitly bypasses passport's state store entirely
 * (see passport-oauth2's `authenticate`), so we mint it here, park it in a
 * short-lived cookie, and compare on the way back.
 */
const STATE_COOKIE = 'oauth_state';

/** Long enough to read a consent screen, short enough not to linger. */
const STATE_TTL_MS = 10 * 60_000;

const COOKIE_OPTIONS = {
	httpOnly: true,
	/**
	 * Must be 'lax', not 'strict'. The callback arrives as a top-level cross-site
	 * GET navigation from the provider; 'strict' would withhold the cookie at
	 * exactly the moment we need to read it, breaking every OAuth login.
	 */
	sameSite: 'lax' as const,
	/** Scoped to the only routes that use it. */
	path: '/auth',
};

/**
 * The provider redirects back to `…/callback`. Keyed on the path rather than on
 * `req.query.code`, because a denied consent comes back with `error` and no
 * `code` — treating that as a fresh authorize leg would bounce the user straight
 * back to the provider in a loop.
 */
function isCallbackLeg(req: Request): boolean {
	return req.path.endsWith('/callback');
}

function equals(a: string, b: string): boolean {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Call from a guard's `canActivate` before delegating to passport. No-op on the
 * authorize leg; on the callback leg it consumes the cookie and throws unless it
 * matches the returned `state`.
 */
export function guardOAuthState(context: ExecutionContext): void {
	const http = context.switchToHttp();
	const req = http.getRequest<Request>();
	if (!isCallbackLeg(req)) {
		return;
	}
	const res = http.getResponse<Response>();
	const expected = req.cookies?.[STATE_COOKIE];
	const received = req.query?.state;
	// Single-use either way, so clear before deciding.
	res.clearCookie(STATE_COOKIE, { path: COOKIE_OPTIONS.path });
	if (
		typeof expected !== 'string' ||
		typeof received !== 'string' ||
		!equals(expected, received)
	) {
		throw new UnauthorizedException('Invalid OAuth state');
	}
}

/**
 * Call from a guard's `getAuthenticateOptions`. On the authorize leg this sets
 * the cookie and hands passport the matching `state` to append to the provider
 * URL; on the callback leg there is nothing to add.
 */
export function oauthStateOptions(
	context: ExecutionContext,
): IAuthModuleOptions {
	const http = context.switchToHttp();
	if (isCallbackLeg(http.getRequest<Request>())) {
		return {};
	}
	const state = randomBytes(32).toString('base64url');
	http.getResponse<Response>().cookie(STATE_COOKIE, state, {
		...COOKIE_OPTIONS,
		secure: configuration().cookie.secure,
		maxAge: STATE_TTL_MS,
	});
	return { state };
}
