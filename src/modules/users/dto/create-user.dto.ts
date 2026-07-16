// src/modules/users/dto/create-user.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  prenom: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  telephone?: string;

  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;

  // CLIENT uniquement
  @IsString()
  @IsOptional()
  nomSociete?: string;

  // EMPLOYEE uniquement
  @IsString()
  @IsOptional()
  poste?: string;
}
