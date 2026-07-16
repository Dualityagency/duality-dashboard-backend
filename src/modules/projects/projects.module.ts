// src/modules/projects/projects.module.ts
import { Module } from '@nestjs/common';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectsService } from './services/projects.service';
import { ProjectsRepository } from './repositories/projects.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { AIGeneratorService } from './services/ai-generator.service';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [PrismaModule, EmployeesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsRepository, AIGeneratorService],
  exports: [ProjectsService, AIGeneratorService],
})
export class ProjectsModule {}
