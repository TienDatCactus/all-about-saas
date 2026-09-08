import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { streamText, isStepCount } from 'ai';
import type { ModelMessage } from 'ai';
import type { Response } from 'express';
import { BadmintonService } from '../badminton/badminton.service';
import { RagService } from './rag.service';
import { kimiChatModel } from './ai.config';
import { buildReadTools } from './tools/read-tools';
import { buildWriteTools } from './tools/write-tools';
import type { PendingAction } from './tools/write-tools';
import {
	ChatMessage,
	ChatMessageRole,
	ToolCallState,
} from './entities/chat-message.entity';
import { SendChatMessageDto, ConfirmChatActionDto } from './dto/chat.dto';

const PENDING_TTL_MS = 15 * 60 * 1000;

const SYSTEM_PROMPT = `You are TwinFoundry's badminton assistant. You can propose
creating a session or marking a participant paid, and answer questions about how
the cost split works using the knowledge base. You can never save a change
yourself — when a tool result has requiresConfirmation: true, tell the user
what you are about to do and that they need to confirm.`;

@Injectable()
export class ChatService {
	constructor(
		@InjectRepository(ChatMessage)
		private readonly chatMessageRepo: Repository<ChatMessage>,
		private readonly badmintonService: BadmintonService,
		private readonly ragService: RagService,
	) {}

	async handleMessage(
		userId: string,
		dto: SendChatMessageDto,
		res: Response,
	): Promise<void> {
		const threadId = dto.threadId ?? crypto.randomUUID();

		// Stop paying for tokens the client will never read.
		const abortController = new AbortController();
		res.on('close', () => abortController.abort());

		const history = dto.threadId
			? await this.chatMessageRepo.find({
					where: { threadId },
					order: { createdAt: 'ASC' },
				})
			: [];

		await this.chatMessageRepo.save(
			this.chatMessageRepo.create({
				threadId,
				userId,
				role: ChatMessageRole.USER,
				content: dto.message,
			}),
		);

		const tools = {
			...buildReadTools({ ragService: this.ragService }),
			...buildWriteTools(),
		};

		const result = streamText({
			model: kimiChatModel,
			system: SYSTEM_PROMPT,
			messages: [
				// `history` only ever holds rows this service itself wrote — user and
				// assistant turns — so the cast just tells TS what's already true at
				// runtime; `ChatMessageRole` is a wider enum than `ModelMessage['role']`
				// allows one-to-one, which is what trips up plain inference here.
				...(history.map((m) => ({
					role: m.role,
					content: m.content,
				})) as ModelMessage[]),
				{ role: 'user' as const, content: dto.message },
			],
			tools,
			stopWhen: isStepCount(5),
			abortSignal: abortController.signal,
			onFinish: async ({ text, toolResults }) => {
				const pending = toolResults
					.map((r) => r.output as PendingAction | undefined)
					.find((output) => output?.requiresConfirmation);

				await this.chatMessageRepo.save(
					this.chatMessageRepo.create({
						threadId,
						userId,
						role: ChatMessageRole.ASSISTANT,
						content: text,
						toolCall: pending
							? { name: pending.action, args: pending.args }
							: null,
						toolCallState: pending ? ToolCallState.PENDING : ToolCallState.NONE,
					}),
				);
			},
		});

		await result.pipeUIMessageStreamToResponse(res);
	}

	async getPendingAction(
		userId: string,
		threadId: string,
	): Promise<{ pending: boolean; summary?: string }> {
		const last = await this.chatMessageRepo.findOne({
			where: { threadId, userId, toolCallState: ToolCallState.PENDING },
			order: { createdAt: 'DESC' },
		});
		if (!last) return { pending: false };

		const age = Date.now() - new Date(last.createdAt).getTime();
		if (age > PENDING_TTL_MS) return { pending: false };

		return { pending: true, summary: last.content };
	}

	async confirmAction(
		userId: string,
		dto: ConfirmChatActionDto,
	): Promise<{ message: string; toolCallState: ToolCallState }> {
		const pending = await this.chatMessageRepo.findOne({
			where: {
				threadId: dto.threadId,
				userId,
				toolCallState: ToolCallState.PENDING,
			},
			order: { createdAt: 'DESC' },
		});
		if (!pending || !pending.toolCall) {
			throw new NotFoundException('No pending action for this thread');
		}

		if (!dto.approve) {
			pending.toolCallState = ToolCallState.REJECTED;
			await this.chatMessageRepo.save(pending);
			return {
				message: 'Cancelled — nothing was saved.',
				toolCallState: pending.toolCallState,
			};
		}

		const { name, args } = pending.toolCall;
		let message: string;

		if (name === 'createBadmintonSession') {
			const session = await this.badmintonService.createSession(
				userId,
				args as never,
			);
			message = `Created session ${session.id}.`;
		} else if (name === 'setParticipantPaid') {
			const { sessionId, participantId, paid } = args as {
				sessionId: string;
				participantId: string;
				paid: boolean;
			};
			await this.badmintonService.setParticipantPaid(
				userId,
				sessionId,
				participantId,
				paid,
			);
			message = `Marked participant as ${paid ? 'paid' : 'unpaid'}.`;
		} else {
			throw new NotFoundException(`Unknown pending tool call: ${name}`);
		}

		pending.toolCallState = ToolCallState.EXECUTED;
		await this.chatMessageRepo.save(pending);
		// Two keys, deliberately: `TransformInterceptor` (apps/api/src/common/
		// interceptor/transform.interceptor.ts) promotes a *single*-key
		// `{ message }` return straight onto the envelope and nulls `data` —
		// exactly what NOT to return here, since the web client reads `data`.
		return { message, toolCallState: pending.toolCallState };
	}
}
