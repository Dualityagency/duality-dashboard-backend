import { IsString, IsOptional, IsNumber } from 'class-validator';

export class SubmitFeedbackContentDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  sentiment?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  score?: number;
}
