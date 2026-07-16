// src/modules/sprints/dto/update-sprint.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateSprintDto } from './create-sprint.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { SprintStatus } from '@prisma/client';

export class UpdateSprintDto extends PartialType(CreateSprintDto) {
  @IsEnum(SprintStatus)
  @IsOptional()
  status?: SprintStatus;
}
