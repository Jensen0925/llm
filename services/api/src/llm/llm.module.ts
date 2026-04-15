import { Module } from '@nestjs/common';
import { AdvancedModule } from './advanced.module';
import { EmbeddingController } from './embedding/embedding.controller';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { RequirementService } from './requirement.service';
import { FilesystemController } from './filesystem/filesystem.controller';
import { MemoryController } from './memory/memory.controller';
import { AgentsController } from './agents/agents.controller';

@Module({
  imports: [AdvancedModule],
  providers: [
    LlmService,
    RequirementService,
  ],
  controllers: [
    LlmController,
    MemoryController,
    FilesystemController,
    EmbeddingController,
    AgentsController,
  ],
  exports: [
    AdvancedModule,
    LlmService,
    RequirementService,
  ],
})
export class LlmModule {}
