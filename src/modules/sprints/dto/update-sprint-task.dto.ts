// src/modules/sprints/dto/update-sprint-task.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateSprintTaskDto } from './create-sprint-task.dto';

export class UpdateSprintTaskDto extends PartialType(CreateSprintTaskDto) {}
