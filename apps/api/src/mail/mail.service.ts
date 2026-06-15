import { renderTemplate } from '@transactional/emails';
import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendEmail(
    options: ISendMailOptions,
    template: string,
    props?: unknown,
  ) {
    const emailHtml = await renderTemplate(template, props);
    await this.mailerService.sendMail({
      ...options,
      template: emailHtml,
    });
  }
}
