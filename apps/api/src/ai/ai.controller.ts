import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { requireUser } from '../common/request-user';
import { ChatService } from './chat.service';
import { ConfirmChatActionDto, SendChatMessageDto } from './dto/chat.dto';

@Controller('ai/chat')
@ApiTags('AI Chat')
@ApiBearerAuth()
export class AiController {
	constructor(private readonly chatService: ChatService) {}

	@Post()
	async chat(
		@Req() req: Request,
		@Res() res: Response,
		@Body() dto: SendChatMessageDto,
	) {
		await this.chatService.handleMessage(requireUser(req).id, dto, res);
	}

	@Get(':threadId/pending-action')
	getPendingAction(@Req() req: Request, @Param('threadId') threadId: string) {
		return this.chatService.getPendingAction(requireUser(req).id, threadId);
	}

	@Post('confirm')
	confirm(@Req() req: Request, @Body() dto: ConfirmChatActionDto) {
		return this.chatService.confirmAction(requireUser(req).id, dto);
	}
}
