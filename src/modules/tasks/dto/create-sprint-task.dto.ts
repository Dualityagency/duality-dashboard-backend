import { IsOptional, IsString, IsEnum, IsNotEmpty, IsInt, Min, Max, IsDateString } from 'class-validator';
import { TaskStatus, TaskPriority } from '@prisma/client';

export class CreateSprintTaskDto {
  @IsString()
  @IsNotEmpty()
  titre: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsNotEmpty()
  sprintId: number;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsDateString()
  @IsNotEmpty()
  dateFin: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  storyPoints?: number;

  @IsInt()
  @IsOptional()
  employeeId?: number;
}
