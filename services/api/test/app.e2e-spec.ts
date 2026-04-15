import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { VectorStoreService } from './../src/llm/embedding/vector-store.service';
import { FilesystemService } from './../src/llm/filesystem/filesystem.service';
import { RequirementService } from './../src/llm/requirement.service';
import { RunnableMemoryService } from './../src/llm/memory/runnable-memory.service';

jest.mock(
  '@repo/contracts',
  () => ({
    APP_NAME: 'llm',
    RequirementResultSchema: {},
  }),
  { virtual: true },
);

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const requirementService = {
    extract: jest.fn(),
  };
  const runnableMemoryService = {
    chat: jest.fn(),
    getHistory: jest.fn(),
    appendMessage: jest.fn(),
    clearSession: jest.fn(),
  };
  const filesystemService = {
    fileChat: jest.fn(),
  };
  const vectorStoreService = {
    addDocuments: jest.fn(),
    similaritySearch: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RequirementService)
      .useValue(requirementService)
      .overrideProvider(RunnableMemoryService)
      .useValue(runnableMemoryService)
      .overrideProvider(FilesystemService)
      .useValue(filesystemService)
      .overrideProvider(VectorStoreService)
      .useValue(vectorStoreService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpAdapter().getInstance())
      .get('/health')
      .expect(200)
      .expect({ ok: true });
  });

  it('/api/langchain/structured (POST)', async () => {
    const result = {
      action: '绑定手机号',
      constraints: ['必须绑定手机号', '密码至少8位'],
      entities: ['用户', '手机号', '密码'],
    };
    requirementService.extract.mockResolvedValue(result);

    await request(app.getHttpAdapter().getInstance())
      .post('/api/langchain/structured')
      .send({ input: '用户注册时必须绑定手机号，密码至少8位' })
      .expect(201)
      .expect(result);

    expect(requirementService.extract).toHaveBeenCalledWith(
      '用户注册时必须绑定手机号，密码至少8位',
    );
  });

  it('/api/memory/chat (POST)', async () => {
    runnableMemoryService.chat.mockResolvedValue({
      response: '可以帮您申请退货，我先为您记录问题。',
    });

    await request(app.getHttpAdapter().getInstance())
      .post('/api/memory/chat')
      .send({
        sessionId: 's1',
        input: '我买的蓝牙耳机降噪效果不好，想退货',
      })
      .expect(201)
      .expect({
        response: '可以帮您申请退货，我先为您记录问题。',
      });

    expect(runnableMemoryService.chat).toHaveBeenCalledWith(
      's1',
      '我买的蓝牙耳机降噪效果不好，想退货',
    );
  });

  it('/api/memory/history (GET)', async () => {
    runnableMemoryService.getHistory.mockResolvedValue([
      { type: 'human', text: '我买的蓝牙耳机降噪效果不好，想退货' },
      { type: 'ai', text: '您好，可以先提供订单号，我帮您判断。' },
    ]);

    await request(app.getHttpAdapter().getInstance())
      .get('/api/memory/history')
      .query({ sessionId: 's1' })
      .expect(200)
      .expect([
        { type: 'human', text: '我买的蓝牙耳机降噪效果不好，想退货' },
        { type: 'ai', text: '您好，可以先提供订单号，我帮您判断。' },
      ]);

    expect(runnableMemoryService.getHistory).toHaveBeenCalledWith('s1');
  });

  it('/api/memory/clear (DELETE)', async () => {
    await request(app.getHttpAdapter().getInstance())
      .delete('/api/memory/clear')
      .query({ sessionId: 's1' })
      .expect(200)
      .expect({ ok: true });

    expect(runnableMemoryService.clearSession).toHaveBeenCalledWith('s1');
  });

  it('/api/files/file-chat (POST)', async () => {
    filesystemService.fileChat.mockResolvedValue({
      result: '已读取订单与退货政策，并将退货判断写入 tickets/EC20240315001-analysis.md',
      toolCalls: [],
    });

    await request(app.getHttpAdapter().getInstance())
      .post('/api/files/file-chat')
      .send({ input: '查询订单 EC20240315001 的详情' })
      .expect(201)
      .expect({
        result:
          '已读取订单与退货政策，并将退货判断写入 tickets/EC20240315001-analysis.md',
        toolCalls: [],
      });

    expect(filesystemService.fileChat).toHaveBeenCalledWith(
      '查询订单 EC20240315001 的详情',
    );
  });

  it('/api/embedding/store (POST)', async () => {
    vectorStoreService.addDocuments.mockResolvedValue({ count: 2 });

    await request(app.getHttpAdapter().getInstance())
      .post('/api/embedding/store')
      .send({
        documents: [
          {
            content: '退货政策内容',
            metadata: { source: 'policies/return-policy.md' },
          },
          {
            content: '退款政策内容',
            metadata: { source: 'policies/refund-policy.md' },
          },
        ],
      })
      .expect(201)
      .expect({ count: 2 });

    expect(vectorStoreService.addDocuments).toHaveBeenCalledWith([
      {
        content: '退货政策内容',
        metadata: { source: 'policies/return-policy.md' },
      },
      {
        content: '退款政策内容',
        metadata: { source: 'policies/refund-policy.md' },
      },
    ]);
  });

  it('/api/embedding/search (POST)', async () => {
    vectorStoreService.similaritySearch.mockResolvedValue([
      {
        content: '退款将在收货确认后 1-3 个工作日原路退回。',
        metadata: { source: 'policies/refund-policy.md' },
      },
    ]);

    await request(app.getHttpAdapter().getInstance())
      .post('/api/embedding/search')
      .send({ query: '退款多久到账', topK: 1 })
      .expect(201)
      .expect([
        {
          content: '退款将在收货确认后 1-3 个工作日原路退回。',
          metadata: { source: 'policies/refund-policy.md' },
        },
      ]);

    expect(vectorStoreService.similaritySearch).toHaveBeenCalledWith(
      '退款多久到账',
      1,
    );
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });
});
