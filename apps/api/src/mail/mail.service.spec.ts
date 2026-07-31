import { MailService } from './mail.service';
import type { MailerService } from '@nestjs-modules/mailer';
import type { ConfigService } from '@nestjs/config';

// The scaffold version instantiated the real service with no MailerService or
// ConfigService, so it failed on DI. Constructing it directly with doubles keeps
// the smoke test and drops the Nest test module entirely.
describe('MailService', () => {
	it('is constructible with its dependencies', () => {
		const service = new MailService(
			{ sendMail: jest.fn() } as unknown as MailerService,
			{ get: jest.fn() } as unknown as ConfigService,
		);
		expect(service).toBeDefined();
	});
});
