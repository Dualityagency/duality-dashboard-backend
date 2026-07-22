/**
 * @file feedback.controller.ts
 * @description Ce fichier gère les requêtes HTTP liées aux feedbacks des clients.
 * @feature Gestion des feedbacks clients
 */

import { Controller, Get, Post, Patch, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { FeedbackService } from '../services/feedback.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { CreateFeedbackDto } from '../dto/create-feedback.dto';
import { UpdateFeedbackDto } from '../dto/update-feedback.dto';
import { SubmitFeedbackContentDto } from '../dto/submit-feedback-content.dto';
import { AnalyzeFeedbackDto } from '../dto/analyze-feedback.dto';

/**
 * Contrôleur gérant les feedbacks des clients.
 * @Controller Définit le préfixe de route 'client/feedback' pour ce contrôleur.
 * @UseGuards Applique le guard JWT pour sécuriser toutes les routes de ce contrôleur.
 */
@Controller('client/feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /**
   * Récupère tous les feedbacks associés au client connecté.
   * @param {any} user - L'utilisateur extrait du token JWT via le décorateur @GetUser.
   * @returns {Promise<any>} Une liste de feedbacks et des statistiques associées.
   */
  @Get()
  async getAll(@GetUser() user: any) {
    return this.feedbackService.getAll(user.id);
  }

  /**
   * Crée un nouveau feedback pour le client connecté.
   * @param {any} user - L'utilisateur extrait du token JWT via le décorateur @GetUser.
   * @param {CreateFeedbackDto} dto - Les données de création du feedback.
   * @returns {Promise<any>} Le feedback créé.
   */
  @Post()
  async create(@GetUser() user: any, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create(user.id, dto);
  }

  /**
   * Analyse le contenu d'un feedback via l'IA avant sa création.
   * @param {AnalyzeFeedbackDto} dto - Le texte du feedback et éventuellement le titre de la tâche associée.
   * @returns {Promise<any>} Les résultats de l'analyse (sentiment, score, suggestions).
   */
  @Post('analyze')
  async analyze(@Body() dto: AnalyzeFeedbackDto) {
    return this.feedbackService.analyze(dto);
  }

  /**
   * Met à jour le statut d'un feedback existant.
   * @param {number} id - L'identifiant unique du feedback à mettre à jour.
   * @param {any} user - L'utilisateur extrait du token JWT via le décorateur @GetUser.
   * @param {UpdateFeedbackDto} dto - Le nouveau statut du feedback.
   * @returns {Promise<any>} Le feedback mis à jour.
   */
  /**
   * Soumet le contenu d'un feedback en réponse à une demande employé.
   * Met à jour le contenu et passe le statut à RESOLU.
   */
  @Patch(':id/submit')
  async submitContent(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: any,
    @Body() dto: SubmitFeedbackContentDto,
  ) {
    return this.feedbackService.submitContent(id, user.id, dto);
  }

  @Patch(':id')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: any,
    @Body() dto: UpdateFeedbackDto,
  ) {
    return this.feedbackService.updateStatus(id, user.id, dto);
  }
}

