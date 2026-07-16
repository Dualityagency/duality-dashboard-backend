import { IsInt, IsString, IsOptional, IsNumber, MaxLength } from 'class-validator' 
 
export type AiMode = 'suggestions' | 'subtasks' | 'estimation' | 'criteria' | 'recommendations' | 'chat' | 'description' 
 
export class AskAiDto { 
  @IsOptional() 
  @IsInt() 
  taskId?: number 

  @IsOptional() 
  @IsString() 
  @MaxLength(500)
  title?: string 

  @IsOptional() 
  @IsString() 
  @MaxLength(500)
  question?: string 

  @IsOptional() 
  @IsString() 
  mode?: AiMode 

  @IsOptional() 
  @IsString() 
  taskType?: 'MARKETING' | 'SPRINT' 

  @IsOptional() 
  @IsNumber() 
  storyPoints?: number 

  @IsOptional() 
  @IsString() 
  sprintName?: string 

  @IsOptional() 
  @IsString() 
  @MaxLength(500)
  description?: string 

  @IsOptional() 
  @IsString() 
  priority?: string 

  @IsOptional() 
  @IsString() 
  status?: string 
} 
