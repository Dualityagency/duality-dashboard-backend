import { IsOptional, IsDateString, IsInt } from 'class-validator';

export class UpdateTimerDto {
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsInt()
  @IsOptional() 
  taskId?: number;

  @IsInt()
  @IsOptional()
  sprintTaskId?: number;
}