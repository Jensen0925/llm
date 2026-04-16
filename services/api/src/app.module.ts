import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LlmModule } from './llm/llm.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, LlmModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
