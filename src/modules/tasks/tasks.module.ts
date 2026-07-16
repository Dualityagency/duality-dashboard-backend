import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TasksController } from './controllers/tasks.controller';
import { TasksService } from './services/tasks.service';
import { TasksRepository } from './repositories/tasks.repository';

@Module({
  imports: [
    MulterModule.register({
      dest: './uploads/tasks',
    }),
  ],
  controllers: [TasksController],
  providers: [TasksService, TasksRepository],
  exports: [TasksService],
})
export class TasksModule {}
