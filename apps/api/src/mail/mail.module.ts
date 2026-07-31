import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import * as dns from 'dns';
@Module({
	imports: [
		MailerModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				transport: {
					host: configService.get('email.host'),
					port: configService.get('email.port'),
					secure: configService.get('email.secure'),
					auth: {
						user: configService.get('email.user'),
						pass: configService.get('email.pass'),
					},
					// The wrapper existed only to forward all three arguments unchanged,
					// and its parameters were implicitly `any`. `dns.lookup` needs no
					// receiver, so it can be handed over directly and keeps its real types.
					lookup: dns.lookup,
					tls: {
						rejectUnauthorized: true,
					},
				},
				defaults: {
					from: '"No Reply" <' + configService.get('email.user') + '>',
				},
			}),
		}),
	],
	// No controller: POST /mail/try was an unauthenticated, fixed-recipient test
	// endpoint that let anyone on the internet make the server send mail.
	providers: [MailService],
})
export class MailModule {}
