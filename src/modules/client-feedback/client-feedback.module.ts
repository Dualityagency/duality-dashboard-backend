/**
 * @file client-feedback.module.ts
 * @description Module NestJS regroupant tous les composants liés à la gestion des feedbacks clients.
 * @feature Gestion des feedbacks clients
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FeedbackController } from './controllers/feedback.controller';
import { FeedbackService } from './services/feedback.service';
import { FeedbackAiService } from './services/feedback-ai.service';
import { FeedbackRepository } from './repositories/feedback.repository';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Module de gestion des feedbacks.
 * @Module Déclare le module et ses dépendances.
 */
@Module({
  // Importation de ConfigModule pour permettre au FeedbackAiService d'accéder aux clés API
  imports: [ConfigModule, NotificationsModule],
  // Déclaration du contrôleur pour ce module
  controllers: [FeedbackController],
  // Déclaration des services et repositories pour l'injection de dépendances
  providers: [
    FeedbackService,
    FeedbackAiService,
    FeedbackRepository,
  ],
})
export class ClientFeedbackModule {}
