import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private service: ChatService) {}

  @Post()
  async chat(@Body('datasetId') datasetId: string, @Body('question') question: string) {
    return this.service.chat(datasetId, question);
  }

  @Get(':id/history')
  async history(@Param('id') id: string) {
    return this.service.getHistory(id);
  }
}
