import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { renderTemplate, type EmailTemplate } from '@transactional/emails';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendEmail(
    options: ISendMailOptions,
    template: EmailTemplate,
    props?: any,
  ) {
    const emailHtml = await renderTemplate(template, props);
    await this.mailerService.sendMail({
      ...options,
      from:
        'All about SaaS' + ' ' + `<${this.configService.get('email.user')}>`,
      replyTo: this.configService.get('email.user'),
      html: emailHtml,
    });
  }
}
