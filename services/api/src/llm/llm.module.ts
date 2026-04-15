import { Module } from '@nestjs/common';
import { EmbeddingController } from './embedding/embedding.controller';
import { EmbeddingService } from './embedding/embedding.service';
import { VectorStoreService } from './embedding/vector-store.service';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { RequirementService } from './requirement.service';
import { FilesystemController } from './filesystem/filesystem.controller';
import { FilesystemService } from './filesystem/filesystem.service';
import { MemoryController } from './memory/memory.controller';
import { RunnableMemoryService } from './memory/runnable-memory.service';

@Module({
  providers: [
    EmbeddingService,
    VectorStoreService,
    LlmService,
    RequirementService,
    RunnableMemoryService,
    FilesystemService,
  ],
  controllers: [
    LlmController,
    MemoryController,
    FilesystemController,
    EmbeddingController,
  ],
  exports: [
    EmbeddingService,
    VectorStoreService,
    LlmService,
    RequirementService,
    RunnableMemoryService,
    FilesystemService,
  ],
})
export class LlmModule {}
