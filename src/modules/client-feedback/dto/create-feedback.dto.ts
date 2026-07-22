/**
 * @file create-feedback.dto.ts
 * @description Objet de transfert de données (DTO) pour la création d'un feedback client.
 * @feature Gestion des feedbacks clients
 */

import { IsString, IsInt, IsOptional, MinLength, IsNumber, IsNotEmpty } from 'class-validator';

/**
 * Classe représentant les données nécessaires pour créer un nouveau feedback.
 */
export class CreateFeedbackDto {
  /**
   * L'identifiant du projet auquel le feedback est rattaché.
   * @IsInt() Vérifie que la valeur est un entier.
   */
  @IsInt()
  projectId: number;

  /**
   * Le contenu textuel du feedback.
   * @IsString() Vérifie que la valeur est une chaîne de caractères.
   * @IsNotEmpty() Vérifie que la chaîne n'est pas vide.
   * @MinLength(10) Impose un minimum de 10 caractères pour un feedback constructif.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Le feedback doit contenir au moins 10 caractères.' })
  content: string;

  /**
   * Le titre de la tâche spécifique concernée (optionnel).
   * @IsString() Vérifie que la valeur est une chaîne.
   * @IsOptional() Indique que ce champ n'est pas obligatoire.
   */
  @IsString()
  @IsOptional()
  taskTitle?: string;

  /**
   * Le sentiment détecté par l'IA ou spécifié manuellement (optionnel).
   * @IsString() Vérifie que la valeur est une chaîne.
   * @IsOptional() Champ optionnel.
   */
  @IsString()
  @IsOptional()
  sentiment?: string;

  /**
   * La catégorie thématique du feedback (ex: Design, Tech) (optionnel).
   * @IsString() Vérifie que la valeur est une chaîne.
   * @IsOptional() Champ optionnel.
   */
  @IsString()
  @IsOptional()
  category?: string;

  /**
   * Le score de qualité/détail calculé par l'IA (optionnel).
   * @IsNumber() Vérifie que la valeur est un nombre.
   * @IsOptional() Champ optionnel.
   */
  @IsNumber()
  @IsOptional()
  score?: number;
}
