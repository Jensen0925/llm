import { Module } from '@nestjs/common';
import { AdvancedController } from './advanced.controller';
import { AdvancedAnalysisService } from './advanced-analysis.service';
import { OrchestratorService } from './agents/orchestrator.service';
import { EmbeddingService } from './embedding/embedding.service';
import { VectorStoreService } from './embedding/vector-store.service';
import { FilesystemService } from './filesystem/filesystem.service';
import { RunnableMemoryService } from './memory/runnable-memory.service';

@Module({
  providers: [
    RunnableMemoryService,
    EmbeddingService,
    VectorStoreService,
    FilesystemService,
    OrchestratorService,
    AdvancedAnalysisService,
  ],
  controllers: [AdvancedController],
  exports: [
    RunnableMemoryService,
    EmbeddingService,
    VectorStoreService,
    FilesystemService,
    OrchestratorService,
    AdvancedAnalysisService,
  ],
})
export class AdvancedModule {}
