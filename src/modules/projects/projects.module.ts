// src/modules/projects/projects.module.ts
import { Module } from '@nestjs/common';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectsService } from './services/projects.service';
import { ProjectsRepository } from './repositories/projects.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { AIGeneratorService } from './services/ai-generator.service';
import { EmployeesModule } from '../employees/employees.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, EmployeesModule, NotificationsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsRepository, AIGeneratorService],
  exports: [ProjectsService, AIGeneratorService],
})
export class ProjectsModule {}