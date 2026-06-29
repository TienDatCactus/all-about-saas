import { Controller, Post } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}
  @Post('/try')
  async trySendMail() {
    await this.mailService.sendEmail(
      {
        to: 'multivncraft@gmail.com',
        subject: 'All About SaaS - Test Email',
      },
      'welcome',
    );
    return { message: 'Email sent successfully' };
  }
}
