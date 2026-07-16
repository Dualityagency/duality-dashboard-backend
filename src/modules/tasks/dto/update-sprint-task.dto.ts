import { IsOptional, IsString, IsEnum, IsInt, Min, Max, IsDateString } from 'class-validator';
import { TaskStatus, TaskPriority } from '@prisma/client';

export class UpdateSprintTaskDto {
  @IsString()
  @IsOptional()
  titre?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsDateString()
  @IsOptional()
  dateFin?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  storyPoints?: number;

  @IsInt()
  @IsOptional()
  employeeId?: number;
}
