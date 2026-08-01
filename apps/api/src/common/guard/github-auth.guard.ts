import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { guardOAuthState, oauthStateOptions } from './oauth-state';

@Injectable()
export class GithubAuthGuard extends AuthGuard('github') {
	canActivate(context: ExecutionContext) {
		guardOAuthState(context);
		return super.canActivate(context);
	}

	getAuthenticateOptions(context: ExecutionContext) {
		return oauthStateOptions(context);
	}
}
