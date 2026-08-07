import {
	ExecutionContext,
	Injectable,
	ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { guardOAuthState, oauthStateOptions } from './oauth-state';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
	constructor(private readonly configService: ConfigService) {
		super({
			accessType: 'offline',
			prompt: 'select_account',
		});
	}

	canActivate(context: ExecutionContext) {
		// The strategy is only registered when the provider is configured
		// (AuthModule); without this check passport reports "Unknown
		// authentication strategy" — an opaque 500 instead of an answer.
		if (!this.configService.get<string>('google.clientId')) {
			throw new ServiceUnavailableException(
				'Google login is not configured in this environment',
			);
		}
		guardOAuthState(context);
		return super.canActivate(context);
	}

	getAuthenticateOptions(context: ExecutionContext) {
		return oauthStateOptions(context);
	}
}
