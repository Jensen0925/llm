import { Injectable } from '@nestjs/common';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';

const EMBEDDING_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

@Injectable()
export class EmbeddingService {
  private readonly embeddings = new HuggingFaceTransformersEmbeddings({
    model: EMBEDDING_MODEL,
  });

  embedQuery(text: string) {
    return this.embeddings.embedQuery(text);
  }

  embedDocuments(documents: string[]) {
    return this.embeddings.embedDocuments(documents);
  }
}

export { EMBEDDING_MODEL };
