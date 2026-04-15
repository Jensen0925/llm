import { Body, Controller, Post } from '@nestjs/common';
import { VectorStoreService } from './vector-store.service';

@Controller('api/embedding')
export class EmbeddingController {
  constructor(private readonly vectorStoreService: VectorStoreService) {}

  @Post('store')
  store(@Body() body: { documents: { content: string; metadata: object }[] }) {
    return this.vectorStoreService.addDocuments(body.documents);
  }

  @Post('search')
  search(@Body() body: { query: string; topK: number }) {
    return this.vectorStoreService.similaritySearch(body.query, body.topK);
  }
}
