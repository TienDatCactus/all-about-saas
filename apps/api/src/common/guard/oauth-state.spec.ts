import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { guardOAuthState, oauthStateOptions } from './oauth-state';

/**
 * The OAuth CSRF check cannot be exercised end-to-end without provider
 * credentials, so it is verified here instead. What matters is that the callback
 * leg *rejects* — a state check that silently passes is worse than none, because
 * it looks like protection.
 */
const context = (req: unknown, res: unknown) =>
	({
		switchToHttp: () => ({
			getRequest: () => req,
			getResponse: () => res,
		}),
	}) as unknown as ExecutionContext;

const makeRes = () => {
	const res: any = {};
	res.cookie = jest.fn(() => res);
	res.clearCookie = jest.fn(() => res);
	return res;
};

describe('OAuth state', () => {
	describe('authorize leg', () => {
		const req = { path: '/auth/google', query: {}, cookies: {} };

		it('issues a state cookie and hands passport the matching value', () => {
			const res = makeRes();

			const options = oauthStateOptions(context(req, res)) as {
				state: string;
			};

			// A string, because passport-oauth2 only appends `state` to the authorize
			// URL when it is a string — an object falls through to its state store.
			expect(typeof options.state).toBe('string');
			expect(options.state.length).toBeGreaterThan(20);
			expect(res.cookie).toHaveBeenCalledWith(
				'oauth_state',
				options.state,
				expect.objectContaining({
					httpOnly: true,
					// 'strict' would withhold the cookie on the provider's cross-site
					// redirect back, breaking every OAuth login.
					sameSite: 'lax',
					path: '/auth',
				}),
			);
		});

		it('does not verify anything (there is nothing to verify yet)', () => {
			expect(() => guardOAuthState(context(req, makeRes()))).not.toThrow();
		});
	});

	describe('callback leg', () => {
		const callback = (state?: string, cookie?: string) => ({
			path: '/auth/google/callback',
			query: state === undefined ? {} : { state },
			cookies: cookie === undefined ? {} : { oauth_state: cookie },
		});

		it('accepts a state that matches the cookie, and consumes it', () => {
			const res = makeRes();

			expect(() =>
				guardOAuthState(context(callback('abc', 'abc'), res)),
			).not.toThrow();
			expect(res.clearCookie).toHaveBeenCalledWith('oauth_state', {
				path: '/auth',
			});
		});

		it('rejects a state that does not match the cookie', () => {
			expect(() =>
				guardOAuthState(context(callback('attacker', 'victim'), makeRes())),
			).toThrow(UnauthorizedException);
		});

		it('rejects when no state cookie was ever issued', () => {
			expect(() =>
				guardOAuthState(context(callback('abc'), makeRes())),
			).toThrow(UnauthorizedException);
		});

		it('rejects when the provider sent no state back', () => {
			expect(() =>
				guardOAuthState(context(callback(undefined, 'abc'), makeRes())),
			).toThrow(UnauthorizedException);
		});

		it('clears the cookie even on rejection, so a value is never reusable', () => {
			const res = makeRes();

			expect(() =>
				guardOAuthState(context(callback('wrong', 'right'), res)),
			).toThrow();
			expect(res.clearCookie).toHaveBeenCalled();
		});

		it('round-trips a state it issued itself', () => {
			const issueRes = makeRes();
			const { state } = oauthStateOptions(
				context({ path: '/auth/google', query: {} }, issueRes),
			) as { state: string };

			expect(() =>
				guardOAuthState(context(callback(state, state), makeRes())),
			).not.toThrow();
		});

		it('adds no state to the authorize params on this leg', () => {
			expect(
				oauthStateOptions(context(callback('abc', 'abc'), makeRes())),
			).toEqual({});
		});
	});
});
