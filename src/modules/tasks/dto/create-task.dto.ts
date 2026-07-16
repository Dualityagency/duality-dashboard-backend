import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, IsArray, IsDateString, Min } from 'class-validator' 
import { TaskStatus, TaskPriority } from '@prisma/client' 

export class CreateTaskDto { 
  @IsString() @IsNotEmpty() 
  titre: string 

  @IsString() @IsOptional() 
  description?: string 

  @IsInt() 
  marketingProjectId: number 

  @IsEnum(TaskStatus) @IsOptional() 
  status?: TaskStatus 

  @IsEnum(TaskPriority) @IsOptional() 
  priority?: TaskPriority 

  @IsDateString() 
  dateFin: string 

  @IsInt() @Min(1) @IsOptional() 
  estimatedHours?: number 

  @IsArray() @IsString({ each: true }) @IsOptional() 
  tags?: string[] 

  @IsInt() @IsOptional() 
  employeeId?: number 

  @IsInt() @IsOptional() 
  blockedByTaskId?: number 
} 