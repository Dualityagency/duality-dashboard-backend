/**
 * @file update-feedback.dto.ts
 * @description Objet de transfert de données (DTO) pour la mise à jour du statut d'un feedback.
 * @feature Gestion des feedbacks clients
 */

import { IsEnum } from 'class-validator';
import { FeedbackStatus } from '@prisma/client';

/**
 * Classe représentant les données autorisées pour la mise à jour d'un feedback.
 */
export class UpdateFeedbackDto {
  /**
   * Le nouveau statut du feedback.
   * @IsEnum(FeedbackStatus) Vérifie que la valeur appartient à l'énumération FeedbackStatus (EN_ATTENTE, EN_COURS, RESOLU).
   */
  @IsEnum(FeedbackStatus)
  status: FeedbackStatus;
}
