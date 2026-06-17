import { renderTemplate, type EmailTemplate } from '@transactional/emails';
import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendEmail(
    options: ISendMailOptions,
    template: EmailTemplate,
    props?: any,
  ) {
    const emailHtml = await renderTemplate(template, props);
    Logger.debug(emailHtml);
    await this.mailerService.sendMail({
      ...options,
      html: emailHtml,
    });
  }
}
