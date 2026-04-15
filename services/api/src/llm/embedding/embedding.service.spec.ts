import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';
import { EMBEDDING_MODEL, EmbeddingService } from './embedding.service';

jest.mock('@langchain/community/embeddings/huggingface_transformers', () => ({
  HuggingFaceTransformersEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn(async (text: string) => [text.length, 1, 0]),
    embedDocuments: jest.fn(async (docs: string[]) =>
      docs.map((doc) => [doc.length, 0, 1]),
    ),
  })),
}));

describe('EmbeddingService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses the configured multilingual embedding model', async () => {
    const service = new EmbeddingService();

    await expect(service.embedQuery('退货政策')).resolves.toEqual([4, 1, 0]);
    await expect(service.embedDocuments(['退款政策', '售后 FAQ'])).resolves.toEqual(
      [
        [4, 0, 1],
        [6, 0, 1],
      ],
    );

    expect(HuggingFaceTransformersEmbeddings).toHaveBeenCalledWith({
      model: EMBEDDING_MODEL,
    });
  });
});
