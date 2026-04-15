import fs from 'node:fs/promises';
import path from 'node:path';
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Document } from '@langchain/core/documents';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { EmbeddingService } from './embedding.service';

type VectorDocumentInput = {
  content: string;
  metadata: object;
};

const INITIAL_VECTOR_FILES = [
  'policies/return-policy.md',
  'policies/refund-policy.md',
  'faq/after-sale-faq.md',
] as const;

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly workspaceRoot = path.resolve(process.cwd(), 'workspace');
  private readonly logger = new Logger(VectorStoreService.name);
  private readonly vectorStore: MemoryVectorStore;
  private initialized = false;
  private seedPromise: Promise<void> | null = null;

  constructor(private readonly embeddingService: EmbeddingService) {
    this.vectorStore = new MemoryVectorStore(this.embeddingService as never);
  }

  async onModuleInit() {
    try {
      await this.ensureSeedDocuments();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown embedding init error';
      this.logger.warn(`Skipping embedding seed during startup: ${message}`);
    }
  }

  async addDocuments(docs: VectorDocumentInput[]) {
    await this.ensureSeedDocuments();

    const documents = docs.map(
      (doc) =>
        new Document({
          pageContent: doc.content,
          metadata: doc.metadata,
        }),
    );

    await this.vectorStore.addDocuments(documents);
    return { count: documents.length };
  }

  async similaritySearch(query: string, topK: number) {
    await this.ensureSeedDocuments();

    const documents = await this.vectorStore.similaritySearch(query, topK);

    return documents.map((doc) => ({
      content: doc.pageContent,
      metadata: doc.metadata,
    }));
  }

  private async ensureSeedDocuments() {
    if (this.initialized) {
      return;
    }

    if (!this.seedPromise) {
      this.seedPromise = this.loadSeedDocuments();
    }

    try {
      await this.seedPromise;
      this.initialized = true;
    } catch (error) {
      this.seedPromise = null;
      throw new ServiceUnavailableException(
        [
          '向量模型尚未就绪：当前需要先加载本地嵌入模型。',
          '如果本机没有缓存该模型且网络受限，embedding 接口会不可用。',
          error instanceof Error ? `底层错误：${error.message}` : '底层错误：未知错误',
        ].join(' '),
      );
    }
  }

  private async loadSeedDocuments() {
    const documents = await Promise.all(
      INITIAL_VECTOR_FILES.map(async (relativePath) => {
        const filePath = path.join(this.workspaceRoot, relativePath);
        const content = await fs.readFile(filePath, 'utf8');

        return {
          content,
          metadata: {
            source: relativePath,
            kind: 'seed',
          },
        };
      }),
    );

    await this.addRawDocuments(documents);
  }

  private async addRawDocuments(docs: VectorDocumentInput[]) {
    const documents = docs.map(
      (doc) =>
        new Document({
          pageContent: doc.content,
          metadata: doc.metadata,
        }),
    );

    await this.vectorStore.addDocuments(documents);
  }
}

export { INITIAL_VECTOR_FILES };
