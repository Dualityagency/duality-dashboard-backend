// src/modules/sprints/dto/create-sprint-task.dto.ts
import { IsString, IsEnum, IsOptional, IsDateString, IsInt } from 'class-validator';
import { TaskStatus, TaskPriority } from '@prisma/client';

export class CreateSprintTaskDto {
  @IsString()
  titre: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority)
  priority: TaskPriority;

  @IsDateString()
  dateFin: string;

  @IsInt()
  @IsOptional()
  storyPoints?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsOptional()
  employeeId?: number;

}
