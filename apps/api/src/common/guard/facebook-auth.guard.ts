import {
	ExecutionContext,
	Injectable,
	ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { guardOAuthState, oauthStateOptions } from './oauth-state';

@Injectable()
export class FacebookAuthGuard extends AuthGuard('facebook') {
	constructor(private readonly configService: ConfigService) {
		super();
	}

	canActivate(context: ExecutionContext) {
		// The strategy is only registered when the provider is configured
		// (AuthModule); without this check passport reports "Unknown
		// authentication strategy" — an opaque 500 instead of an answer.
		if (!this.configService.get<string>('facebook.clientId')) {
			throw new ServiceUnavailableException(
				'Facebook login is not configured in this environment',
			);
		}
		guardOAuthState(context);
		return super.canActivate(context);
	}

	getAuthenticateOptions(context: ExecutionContext) {
		return oauthStateOptions(context);
	}
}
