import { IsInt } from 'class-validator';

export class CreateDirectDto {
  @IsInt()
  userId: number;
}
