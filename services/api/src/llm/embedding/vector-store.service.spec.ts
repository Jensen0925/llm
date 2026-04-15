import { VectorStoreService } from './vector-store.service';

describe('VectorStoreService', () => {
  const embeddingService = {
    embedQuery: jest.fn(async (text: string) => [text.length, text.length / 10]),
    embedDocuments: jest.fn(async (documents: string[]) =>
      documents.map((doc) => [doc.length, doc.length / 10]),
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores documents and searches similar content', async () => {
    const service = new VectorStoreService(embeddingService as never);

    await service.addDocuments([
      {
        content: '本订单满足 7 天无理由退货条件。',
        metadata: { source: 'policies/return-policy.md' },
      },
      {
        content: '退款将在收货确认后 1-3 个工作日原路返回。',
        metadata: { source: 'policies/refund-policy.md' },
      },
    ]);

    const result = await service.similaritySearch('退货条件', 5);

    expect(result.length).toBeGreaterThan(0);
    expect(
      result.some(
        (doc) =>
          (doc.metadata as { source?: string }).source ===
          'policies/return-policy.md',
      ),
    ).toBe(true);
    expect(embeddingService.embedDocuments).toHaveBeenCalled();
    expect(embeddingService.embedQuery).toHaveBeenCalledWith('退货条件');
  });

  it('loads seed documents on module init', async () => {
    const service = new VectorStoreService(embeddingService as never);

    await service.onModuleInit();
    const result = await service.similaritySearch('售后 FAQ', 3);

    expect(result.length).toBeGreaterThan(0);
    expect(
      result.some(
        (doc) => (doc.metadata as { source?: string }).source === 'faq/after-sale-faq.md',
      ),
    ).toBe(true);
  });
});
