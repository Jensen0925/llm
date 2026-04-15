import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { RunnableMemoryService } from './runnable-memory.service';

@Controller('api/memory')
export class MemoryController {
  constructor(private readonly runnableMemoryService: RunnableMemoryService) {}

  @Post('chat')
  chat(@Body() body: { sessionId: string; input: string }) {
    return this.runnableMemoryService.chat(body.sessionId, body.input);
  }

  @Get('history')
  getHistory(@Query('sessionId') sessionId: string) {
    return this.runnableMemoryService.getHistory(sessionId);
  }

  @Delete('clear')
  clear(@Query('sessionId') sessionId: string) {
    this.runnableMemoryService.clearSession(sessionId);
    return { ok: true };
  }
}
