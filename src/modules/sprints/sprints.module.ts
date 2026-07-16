// src/modules/sprints/sprints.module.ts
import { Module } from '@nestjs/common';
import { SprintsController } from './controllers/sprints.controller';
import { SprintsService } from './services/sprints.service';
import { SprintsRepository } from './repositories/sprints.repository';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SprintsController],
  providers: [SprintsService, SprintsRepository],
  exports: [SprintsService],
})
export class SprintsModule {}
