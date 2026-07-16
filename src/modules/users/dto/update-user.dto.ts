import { IsEmail, IsOptional, IsString, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  status?: string; // ACTIF | SUSPENDU

  @IsString()
  @IsOptional()
  nom?: string;

  @IsString()
  @IsOptional()
  prenom?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  telephone?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsString()
  @IsOptional()
  avatar?: string;

  // Spécifique CLIENT
  @IsString()
  @IsOptional()
  nomSociete?: string;

  // Spécifique EMPLOYEE
  @IsString()
  @IsOptional()
  poste?: string;
}
