import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvidersModule } from '../providers/providers.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsageModule } from '../usage/usage.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
    ProvidersModule,
    SubscriptionsModule,
    UsageModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}