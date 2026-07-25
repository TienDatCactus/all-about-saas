import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BadmintonService } from './badminton.service';

/**
 * Public, unauthenticated read of a session via its share token — lets anyone
 * verify the split. No guards; the service returns a PII-safe view.
 */
@ApiTags('Badminton (public)')
@Controller('public/badminton/sessions')
export class BadmintonPublicController {
  constructor(private readonly service: BadmintonService) {}

  @Get(':shareToken')
  findByShareToken(@Param('shareToken') shareToken: string) {
    return this.service.findByShareToken(shareToken);
  }
}
