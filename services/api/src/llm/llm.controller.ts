import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LlmService } from './llm.service';
import { RequirementService } from './requirement.service';

const DEFAULT_REQUIREMENT_INPUT = '用户注册时必须绑定手机号，密码至少8位';

@Controller('api/langchain')
export class LlmController {
  constructor(
    private readonly llmService: LlmService,
    private readonly requirementService: RequirementService,
  ) {}

  @Post('invoke')
  async invoke(@Body() body?: { input?: string }) {
    const result = await this.llmService.invokeDemo(
      body?.input ?? DEFAULT_REQUIREMENT_INPUT,
    );
    return { result };
  }
  @Post('stream')
  async stream(@Body() body: { input?: string } | undefined, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await this.llmService.streamDemo(
      body?.input ?? DEFAULT_REQUIREMENT_INPUT,
    );

    for await (const chunk of stream) {
      res.write(chunk.content.toString());
    }

    res.end();
  }
  @Post('batch')
  async batch(@Body() body?: { inputs?: string[] }) {
    const results = await this.llmService.batchDemo(
      body?.inputs?.length ? body.inputs : [DEFAULT_REQUIREMENT_INPUT],
    );
    return { results };
  }
  @Post('prompt-preview')
  async promptPreview(@Body() body?: { input?: string }) {
    return this.llmService.promptPreview(body?.input ?? DEFAULT_REQUIREMENT_INPUT);
  }
  @Post('prompt-to-model')
  async promptToModel(@Body() body?: { input?: string }) {
    return this.llmService.promptToModel(body?.input ?? DEFAULT_REQUIREMENT_INPUT);
  }
  @Post('chain-invoke')
  async chainInvoke(@Body() body?: { input?: string }) {
    return this.llmService.chainInvoke(body?.input ?? DEFAULT_REQUIREMENT_INPUT);
  }
  @Post('chain-stream')
  async chainStream(
    @Body() body: { input?: string } | undefined,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await this.llmService.chainStream(
      body?.input ?? DEFAULT_REQUIREMENT_INPUT,
    );

    for await (const chunk of stream) {
      res.write(chunk);
    }

    res.end();
  }
  @Post('chain-batch')
  async chainBatch(@Body() body?: { inputs?: string[] }) {
    return this.llmService.chainBatch(
      body?.inputs?.length ? body.inputs : [DEFAULT_REQUIREMENT_INPUT],
    );
  }
  @Post('structured')
  structured(@Body() body?: { input?: string }) {
    return this.requirementService.extract(body?.input ?? DEFAULT_REQUIREMENT_INPUT);
  }
  @Post('tool-bind')
  toolBind(@Body() body?: { input?: string }) {
    return this.llmService.toolBindDemo(body?.input ?? DEFAULT_REQUIREMENT_INPUT);
  }
  @Post('tool-loop')
  toolLoop(@Body() body?: { input?: string }) {
    return this.llmService.toolLoopDemo(body?.input ?? DEFAULT_REQUIREMENT_INPUT);
  }
}
