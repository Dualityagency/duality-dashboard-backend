import { IsString, Length } from 'class-validator';

export class EditMessageDto {
  @IsString()
  @Length(1, 5000)
  content: string;
}
