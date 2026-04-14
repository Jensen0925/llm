import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { APP_NAME } from '@repo/contracts';
import { RequirementService } from './llm/requirement.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly requirementService: RequirementService,
  ) { }

  @Get('/health')
  health() {
    return { ok: true };
  }
  @Get('/hello')
  hello() {
    return { message: `Hello from API, shared APP_NAME=${APP_NAME}` };
  }
  @Post('/requirement/extract')
  extract(@Body() body: { input: string }) {
    return this.requirementService.extract(body.input);
  }
}
