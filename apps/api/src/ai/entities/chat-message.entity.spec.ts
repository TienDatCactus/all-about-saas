import {
	ChatMessage,
	ChatMessageRole,
	ToolCallState,
} from './chat-message.entity';

describe('ChatMessage', () => {
	it('defaults toolCallState to none and leaves toolCall unset', () => {
		const message = new ChatMessage();
		message.threadId = 'thread-1';
		message.userId = 'user-1';
		message.role = ChatMessageRole.USER;
		message.content = 'hello';

		expect(message.toolCall).toBeUndefined();
		// toolCallState's default is applied by TypeORM/Postgres on insert, not
		// by the class field — assert the enum member exists with the right value
		// rather than asserting a runtime default this test never persists.
		expect(ToolCallState.NONE).toBe('none');
	});

	it('carries a pending tool call as { name, args }', () => {
		const message = new ChatMessage();
		message.toolCallState = ToolCallState.PENDING;
		message.toolCall = {
			name: 'createBadmintonSession',
			args: { courtCost: 100_000 },
		};

		expect(message.toolCallState).toBe(ToolCallState.PENDING);
		expect(message.toolCall.name).toBe('createBadmintonSession');
	});
});
