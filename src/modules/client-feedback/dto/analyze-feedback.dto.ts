/**
 * @file analyze-feedback.dto.ts
 * @description Objet de transfert de données (DTO) pour la demande d'analyse IA d'un feedback.
 * @feature Gestion des feedbacks clients / IA
 */

import { IsString, MinLength, IsOptional } from 'class-validator';

/**
 * Classe représentant les données envoyées pour demander une analyse IA.
 */
export class AnalyzeFeedbackDto {
  /**
   * Le contenu textuel brut du feedback à analyser par l'IA.
   * @IsString() Vérifie que la valeur est une chaîne.
   * @MinLength(10) Assure un minimum de texte pour que l'IA puisse travailler.
   */
  @IsString()
  @MinLength(10, { message: 'Le texte à analyser doit contenir au moins 10 caractères.' })
  description: string;

  /**
   * Le titre de la tâche liée au feedback (optionnel, aide l'IA pour le contexte).
   * @IsString() Vérifie que la valeur est une chaîne.
   * @IsOptional() Champ optionnel.
   */
  @IsString()
  @IsOptional()
  taskTitle?: string;
}