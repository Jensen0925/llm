import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LlmService } from './llm.service';
import { RequirementService } from './requirement.service';

const DEFAULT_REQUIREMENT_INPUT = '用户注册时必须绑定手机号，密码至少8位';
const SSE_START_FRAME = ': stream-start\n\n';
const SSE_DONE_EVENT = 'done';
const SSE_ERROR_EVENT = 'error';

@Controller('api/langchain')
export class LlmController {
  constructor(
    private readonly llmService: LlmService,
    private readonly requirementService: RequirementService,
  ) {}

  private setupSseResponse(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(SSE_START_FRAME);
  }

  private writeSseData(res: Response, payload: string) {
    if (!payload) return;

    const frame = payload
      .split(/\r?\n/)
      .map((line) => `data: ${line}`)
      .join('\n');

    res.write(`${frame}\n\n`);
  }

  private writeSseEvent(res: Response, event: string, payload: string) {
    const lines = payload.split(/\r?\n/).map((line) => `data: ${line}`);
    res.write(`event: ${event}\n${lines.join('\n')}\n\n`);
  }

  private getChunkText(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (!Array.isArray(content)) {
      return '';
    }

    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (
          part &&
          typeof part === 'object' &&
          'type' in part &&
          part.type === 'text' &&
          'text' in part &&
          typeof part.text === 'string'
        ) {
          return part.text;
        }

        return '';
      })
      .join('');
  }

  private async pipeSseStream<T>(
    res: Response,
    stream: AsyncIterable<T>,
    getPayload: (chunk: T) => string,
  ) {
    this.setupSseResponse(res);

    try {
      for await (const chunk of stream) {
        this.writeSseData(res, getPayload(chunk));
      }

      this.writeSseEvent(res, SSE_DONE_EVENT, '[DONE]');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'stream failed';
      this.writeSseEvent(res, SSE_ERROR_EVENT, message);
    } finally {
      res.end();
    }
  }

  @Post('invoke')
  async invoke(@Body() body?: { input?: string }) {
    const result = await this.llmService.invokeDemo(
      body?.input ?? DEFAULT_REQUIREMENT_INPUT,
    );
    return { result };
  }
  @Post('stream')
  async stream(
    @Body() body: { input?: string } | undefined,
    @Res() res: Response,
  ) {
    const stream = await this.llmService.streamDemo(
      body?.input ?? DEFAULT_REQUIREMENT_INPUT,
    );
    await this.pipeSseStream(res, stream, (chunk) =>
      this.getChunkText(chunk.content),
    );
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
    return this.llmService.promptPreview(
      body?.input ?? DEFAULT_REQUIREMENT_INPUT,
    );
  }
  @Post('prompt-to-model')
  async promptToModel(@Body() body?: { input?: string }) {
    return this.llmService.promptToModel(
      body?.input ?? DEFAULT_REQUIREMENT_INPUT,
    );
  }
  @Post('chain-invoke')
  async chainInvoke(@Body() body?: { input?: string }) {
    return this.llmService.chainInvoke(
      body?.input ?? DEFAULT_REQUIREMENT_INPUT,
    );
  }
  @Post('chain-stream')
  async chainStream(
    @Body() body: { input?: string } | undefined,
    @Res() res: Response,
  ) {
    const stream = await this.llmService.chainStream(
      body?.input ?? DEFAULT_REQUIREMENT_INPUT,
    );
    await this.pipeSseStream(res, stream, (chunk) => chunk);
  }
  @Post('chain-batch')
  async chainBatch(@Body() body?: { inputs?: string[] }) {
    return this.llmService.chainBatch(
      body?.inputs?.length ? body.inputs : [DEFAULT_REQUIREMENT_INPUT],
    );
  }
  @Post('structured')
  structured(@Body() body?: { input?: string }) {
    return this.requirementService.extract(
      body?.input ?? DEFAULT_REQUIREMENT_INPUT,
    );
  }
  @Post('tool-bind')
  toolBind(@Body() body?: { input?: string }) {
    return this.llmService.toolBindDemo(
      body?.input ?? DEFAULT_REQUIREMENT_INPUT,
    );
  }
  @Post('tool-loop')
  toolLoop(@Body() body?: { input?: string }) {
    return this.llmService.toolLoopDemo(
      body?.input ?? DEFAULT_REQUIREMENT_INPUT,
    );
  }
}
