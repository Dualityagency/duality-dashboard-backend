import { IsEnum, IsInt, IsNotEmpty, IsOptional } from 'class-validator';

export enum TaskType {
  SPRINT = 'SPRINT',
  MARKETING = 'MARKETING',
}

export class StartTimerDto {
  @IsEnum(TaskType)
  @IsNotEmpty()
  type: TaskType;

}