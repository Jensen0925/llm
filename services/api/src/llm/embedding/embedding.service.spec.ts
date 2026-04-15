import { existsSync } from 'node:fs';
import { env as transformersEnv } from '@huggingface/transformers';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';
import {
  EMBEDDING_MODEL,
  EmbeddingService,
  LOCAL_EMBEDDING_MODEL_PATH,
  LOCAL_MODELS_ROOT,
} from './embedding.service';

jest.mock('node:fs', () => ({
  existsSync: jest.fn(() => true),
}));

jest.mock('@huggingface/transformers', () => ({
  env: {
    allowLocalModels: true,
    allowRemoteModels: true,
    localModelPath: '',
  },
}));

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
    (existsSync as jest.Mock).mockReturnValue(true);
    transformersEnv.allowLocalModels = true;
    transformersEnv.allowRemoteModels = true;
    transformersEnv.localModelPath = '';
  });

  it('uses the downloaded local multilingual embedding model', async () => {
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
      pretrainedOptions: {
        local_files_only: true,
      },
    });
    expect(transformersEnv.allowLocalModels).toBe(true);
    expect(transformersEnv.allowRemoteModels).toBe(false);
    expect(transformersEnv.localModelPath).toBe(LOCAL_MODELS_ROOT);
  });

  it('throws a helpful error when the local model files are missing', () => {
    (existsSync as jest.Mock).mockReturnValue(false);

    expect(() => new EmbeddingService()).toThrow(
      `Missing local embedding model files in "${LOCAL_EMBEDDING_MODEL_PATH}"`,
    );
  });
});
