import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsInt,
} from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @IsOptional()
  content?: string;

  @IsOptional()
  @IsInt()
  replyToId?: number;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}
