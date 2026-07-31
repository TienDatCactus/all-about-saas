import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { guardOAuthState, oauthStateOptions } from './oauth-state';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
	constructor() {
		super({
			accessType: 'offline',
			prompt: 'select_account',
		});
	}

	canActivate(context: ExecutionContext) {
		guardOAuthState(context);
		return super.canActivate(context);
	}

	getAuthenticateOptions(context: ExecutionContext) {
		return oauthStateOptions(context);
	}
}
