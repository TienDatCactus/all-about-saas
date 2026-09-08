import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadmintonModule } from '../badminton/badminton.module';
import { ChatMessage } from './entities/chat-message.entity';
import { AiController } from './ai.controller';
import { ChatService } from './chat.service';
import { RagService } from './rag.service';
import { qdrantClientProvider } from './qdrant.provider';

@Module({
	imports: [TypeOrmModule.forFeature([ChatMessage]), BadmintonModule],
	controllers: [AiController],
	providers: [ChatService, RagService, qdrantClientProvider],
})
export class AiModule {}
