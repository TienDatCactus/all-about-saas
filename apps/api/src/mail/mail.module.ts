import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
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
          lookup: (hostname, options, callback) => {
            dns.lookup(hostname, { family: 4 }, callback);
          },
          tls: {
            rejectUnauthorized: false,
          },
        },
        defaults: {
          from: '"No Reply" <' + configService.get('email.user') + '>',
        },
      }),
    }),
  ],
  providers: [MailService],
  controllers: [MailController],
})
export class MailModule {}
