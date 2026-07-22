/**
 * @file feedback.service.ts
 * @description Service orchestrant la logique métier des feedbacks clients, incluant l'intégration IA.
 * @feature Gestion des feedbacks clients
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FeedbackRepository } from '../repositories/feedback.repository';
import { FeedbackAiService, AIAnalysisResult } from './feedback-ai.service';
import { CreateFeedbackDto } from '../dto/create-feedback.dto';
import { UpdateFeedbackDto } from '../dto/update-feedback.dto';
import { SubmitFeedbackContentDto } from '../dto/submit-feedback-content.dto';
import { AnalyzeFeedbackDto } from '../dto/analyze-feedback.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

/**
 * Service pour la gestion des feedbacks.
 * @Injectable Marque la classe comme un fournisseur qui peut être injecté dans d'autres classes.
 */
@Injectable()
export class FeedbackService {
  constructor(
    private feedbackRepository: FeedbackRepository,
    private feedbackAiService: FeedbackAiService,
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Récupère les informations du client à partir de son identifiant d'utilisateur.
   * @param {number} utilisateurId - L'identifiant de l'utilisateur.
   * @returns {Promise<any>} Le profil client trouvé.
   * @throws {BadRequestException} Si le client n'existe pas.
   */
  private async getClientByUtilisateurId(utilisateurId: number) {
    // Recherche le client associé à l'ID utilisateur dans la base de données
    const client = await this.prisma.client.findUnique({
      where: { utilisateurId },
    });
    
    // Vérifie l'existence du client
    if (!client) {
      throw new BadRequestException('Client non trouvé pour cet utilisateur');
    }
    return client;
  }

  /**
   * Récupère tous les feedbacks d'un client ainsi que les statistiques globales.
   * @param {number} utilisateurId - L'identifiant de l'utilisateur connecté.
   * @returns {Promise<any>} Un objet contenant les statistiques et la liste des feedbacks.
   */
  async getAll(utilisateurId: number) {
    const client = await this.getClientByUtilisateurId(utilisateurId);
    
    // Récupération simultanée des feedbacks et des statistiques via le repository
    const feedbacks = await this.feedbackRepository.findAllByClientId(client.id);
    const stats = await this.feedbackRepository.getStats(client.id);
    
    return { stats, feedbacks };
  }

  /**
   * Crée un nouveau feedback après avoir récupéré le profil client.
   * @param {number} utilisateurId - L'identifiant de l'utilisateur connecté.
   * @param {CreateFeedbackDto} dto - Les données du feedback.
   * @returns {Promise<any>} Le feedback créé.
   */
  async create(utilisateurId: number, dto: CreateFeedbackDto) {
    const client = await this.getClientByUtilisateurId(utilisateurId);
    
    // Si le sentiment, la catégorie ou le score ne sont pas fournis, on pourrait appeler l'IA ici
    // Mais selon le flux standard, le client appelle /analyze puis /create avec les champs remplis.
    // On s'assure simplement que le repository enregistre tout ce qui est fourni dans le DTO.
    
    return this.feedbackRepository.create(client.id, dto);
  }

  /**
   * Met à jour le statut d'un feedback après validation de propriété.
   * @param {number} id - L'identifiant du feedback.
   * @param {number} utilisateurId - L'identifiant de l'utilisateur connecté.
   * @param {UpdateFeedbackDto} dto - Le nouveau statut.
   * @returns {Promise<any>} Le feedback mis à jour.
   * @throws {NotFoundException} Si le feedback n'existe pas ou n'appartient pas au client.
   */
  async updateStatus(id: number, utilisateurId: number, dto: UpdateFeedbackDto) {
    const client = await this.getClientByUtilisateurId(utilisateurId);
    
    // Vérifie que le feedback appartient bien au client connecté
    const feedback = await this.feedbackRepository.findByIdAndClientId(id, client.id);
    
    if (!feedback) {
      throw new NotFoundException(`Feedback avec l'ID ${id} non trouvé pour ce client`);
    }

    const updatedFeedback = await this.feedbackRepository.updateStatus(id, dto.status);

    const clientUser = await this.prisma.client.findUnique({ 
      where: { id: feedback.clientId }, 
      select: { utilisateurId: true }, 
    }); 
    if (clientUser) { 
      const statusLabel = dto.status === 'EN_COURS' ? 'en cours de traitement' : 'résolu'; 
      this.notificationsService.createNotification( 
        clientUser.utilisateurId, 
        NotificationType.FEEDBACK_STATUS_UPDATED, 
        'Feedback mis à jour', 
        `Votre feedback "${feedback.taskTitle ?? ''}" est maintenant ${statusLabel}.`, 
        id, 
        'Feedback', 
      ).catch(() => {}); 
    } 

    return updatedFeedback;
  }

  /**
   * Met à jour le contenu d'un feedback existant créé par une demande employé.
   * Vérifie que le feedback appartient au client, puis enregistre le contenu et passe le statut à RESOLU.
   */
  async submitContent(id: number, utilisateurId: number, dto: SubmitFeedbackContentDto) {
    const client = await this.getClientByUtilisateurId(utilisateurId);
    const feedback = await this.feedbackRepository.findByIdAndClientId(id, client.id);
    if (!feedback) {
      throw new NotFoundException(`Feedback avec l'ID ${id} non trouvé pour ce client`);
    }
    return this.feedbackRepository.submitContent(id, dto);
  }

  /**
   * Analyse le contenu d'un feedback en utilisant le service d'IA.
   * @param {AnalyzeFeedbackDto} dto - Les données à analyser.
   * @returns {Promise<AIAnalysisResult>} Les résultats détaillés de l'analyse IA.
   */
  async analyze(dto: AnalyzeFeedbackDto): Promise<AIAnalysisResult> {
    return this.feedbackAiService.analyzeFeedback(dto.description, dto.taskTitle);
  }
}
