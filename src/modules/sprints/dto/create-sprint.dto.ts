// src/modules/sprints/dto/create-sprint.dto.ts
import { IsString, IsOptional, IsDateString, IsNumber, IsInt } from 'class-validator';

export class CreateSprintDto {
  @IsString()
  nom: string;

  @IsString()
  @IsOptional()
  goal?: string;

  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsNumber()
  @IsOptional()
  velocityPrevue?: number;

  @IsInt()
  webProjectId: number;
}
