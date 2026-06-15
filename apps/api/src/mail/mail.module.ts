import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

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
        },
        defaults: {
          from: '"No Reply" <' + configService.get('email.user') + '>',
        },
      }),
    }),
  ],
  providers: [MailService],
})
export class MailModule {}
