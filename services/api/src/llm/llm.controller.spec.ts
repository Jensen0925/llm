import type { Response } from 'express';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';
import { RequirementService } from './requirement.service';

jest.mock(
  '@repo/contracts',
  () => ({
    RequirementResultSchema: {},
  }),
  { virtual: true },
);

type MockResponse = Pick<
  Response,
  'setHeader' | 'write' | 'end' | 'flushHeaders'
>;

function createResponseMock(): MockResponse {
  return {
    setHeader: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    flushHeaders: jest.fn(),
  };
}

async function* createModelStream() {
  yield { content: '第一段' };
  yield { content: '第二段\n换行' };
}

async function* createChainStream() {
  yield 'alpha';
  yield 'beta';
}

describe('LlmController', () => {
  let controller: LlmController;
  let llmService: jest.Mocked<LlmService>;
  let requirementService: jest.Mocked<RequirementService>;

  beforeEach(() => {
    llmService = {
      invokeDemo: jest.fn(),
      streamDemo: jest.fn(),
      batchDemo: jest.fn(),
      promptPreview: jest.fn(),
      promptToModel: jest.fn(),
      chainInvoke: jest.fn(),
      chainStream: jest.fn(),
      chainBatch: jest.fn(),
      toolBindDemo: jest.fn(),
      toolLoopDemo: jest.fn(),
    } as unknown as jest.Mocked<LlmService>;

    requirementService = {
      extract: jest.fn(),
    } as unknown as jest.Mocked<RequirementService>;

    controller = new LlmController(llmService, requirementService);
  });

  it('streams model output as SSE frames', async () => {
    llmService.streamDemo.mockResolvedValue(
      createModelStream() as Awaited<ReturnType<LlmService['streamDemo']>>,
    );
    const response = createResponseMock();

    await controller.stream(undefined, response as Response);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream; charset=utf-8',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-cache, no-transform',
    );
    expect(response.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(response.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(response.flushHeaders).toHaveBeenCalled();
    expect(response.write).toHaveBeenNthCalledWith(1, ': stream-start\n\n');
    expect(response.write).toHaveBeenNthCalledWith(2, 'data: 第一段\n\n');
    expect(response.write).toHaveBeenNthCalledWith(
      3,
      'data: 第二段\ndata: 换行\n\n',
    );
    expect(response.write).toHaveBeenNthCalledWith(
      4,
      'event: done\ndata: [DONE]\n\n',
    );
    expect(response.end).toHaveBeenCalled();
  });

  it('streams chain output as SSE frames', async () => {
    llmService.chainStream.mockResolvedValue(
      createChainStream() as Awaited<ReturnType<LlmService['chainStream']>>,
    );
    const response = createResponseMock();

    await controller.chainStream(undefined, response as Response);

    expect(response.write).toHaveBeenNthCalledWith(1, ': stream-start\n\n');
    expect(response.write).toHaveBeenNthCalledWith(2, 'data: alpha\n\n');
    expect(response.write).toHaveBeenNthCalledWith(3, 'data: beta\n\n');
    expect(response.write).toHaveBeenNthCalledWith(
      4,
      'event: done\ndata: [DONE]\n\n',
    );
    expect(response.end).toHaveBeenCalled();
  });

  it('delegates structured input to RequirementService', async () => {
    const result = {
      action: '绑定手机号',
      constraints: ['必须绑定手机号', '密码至少8位'],
      entities: ['用户', '手机号', '密码'],
    };
    requirementService.extract.mockResolvedValue(result);

    await expect(
      controller.structured({ input: '用户注册时必须绑定手机号，密码至少8位' }),
    ).resolves.toEqual(result);

    expect(requirementService.extract).toHaveBeenCalledWith(
      '用户注册时必须绑定手机号，密码至少8位',
    );
  });

  it('uses default input for structured when body is empty', async () => {
    const result = {
      action: '绑定手机号',
      constraints: ['必须绑定手机号', '密码至少8位'],
      entities: ['用户', '手机号', '密码'],
    };
    requirementService.extract.mockResolvedValue(result);

    await controller.structured(undefined);

    expect(requirementService.extract).toHaveBeenCalledWith(
      '用户注册时必须绑定手机号，密码至少8位',
    );
  });
});
