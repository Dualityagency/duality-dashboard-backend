// src/modules/projects/dto/create-project.dto.ts
import { IsString, IsNumber, IsDateString, IsEnum, IsArray, IsOptional } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  budget: number;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsNumber()
  client: number;

  @IsEnum(['Web', 'Marketing'])
  projectType: string;

  @IsArray()
  @IsOptional()
  members?: number[];

  @IsString()
  @IsOptional()
  status?: string;
}
