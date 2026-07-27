import { ExecutionContext, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

export class CustomeThrottlerGuard extends ThrottlerGuard {
	logger = new Logger(CustomeThrottlerGuard.name);
	canActivate(context: ExecutionContext) {
		this.logger.log('===TRIGGER GLOBAL GUARD===');
		return super.canActivate(context);
	}
}
