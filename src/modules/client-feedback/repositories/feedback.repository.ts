/**
 * @file feedback.repository.ts
 * @description Repository gérant les accès à la base de données pour l'entité Feedback via Prisma.
 * @feature Gestion des feedbacks clients
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateFeedbackDto } from '../dto/create-feedback.dto';
import { FeedbackStatus } from '@prisma/client';

/**
 * Repository pour les opérations de persistance des feedbacks.
 * @Injectable Marque la classe comme injectable.
 */
@Injectable()
export class FeedbackRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Récupère tous les feedbacks d'un client spécifique, incluant le nom du projet associé.
   * @param {number} clientId - L'identifiant du client.
   * @returns {Promise<any[]>} Une liste de feedbacks triés par date de création décroissante.
   */
  async findAllByClientId(clientId: number) {
    // Requête Prisma pour récupérer les feedbacks d'un client avec jointure sur Project
    return this.prisma.feedback.findMany({
      where: { clientId },
      select: {
        id: true,
        content: true,
        status: true,
        taskTitle: true,
        sentiment: true,
        category: true,
        score: true,
        taskId: true,
        feedbackRequestedAt: true,
        createdAt: true,
        projectId: true,
        project: { select: { nom: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Enregistre un nouveau feedback dans la base de données.
   * @param {number} clientId - L'identifiant du client auteur.
   * @param {CreateFeedbackDto} data - Les données du feedback.
   * @returns {Promise<any>} Le feedback créé.
   */
  async create(clientId: number, data: CreateFeedbackDto) {
    // Création d'une entrée Feedback dans Prisma
    return this.prisma.feedback.create({
      data: {
        content: data.content,
        taskTitle: data.taskTitle ?? null,
        sentiment: data.sentiment ?? null,
        category: data.category ?? null,
        score: data.score ?? null,
        status: FeedbackStatus.EN_ATTENTE,
        clientId,
        projectId: data.projectId,
      },
    });
  }

  /**
   * Met à jour le statut d'un feedback.
   * @param {number} id - L'identifiant du feedback.
   * @param {FeedbackStatus} status - Le nouveau statut (EN_ATTENTE, EN_COURS, RESOLU).
   * @returns {Promise<any>} Le feedback mis à jour.
   */
  async updateStatus(id: number, status: FeedbackStatus) {
    // Mise à jour du statut d'un feedback spécifique via Prisma
    return this.prisma.feedback.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Recherche un feedback par son ID et s'assure qu'il appartient au bon client.
   * @param {number} id - L'identifiant du feedback.
   * @param {number} clientId - L'identifiant du client.
   * @returns {Promise<any|null>} Le feedback trouvé ou null.
   */
  async findByIdAndClientId(id: number, clientId: number) {
    // Recherche sécurisée par ID et clientId via Prisma
    return this.prisma.feedback.findFirst({
      where: { id, clientId },
    });
  }

  /**
   * Met à jour le contenu d'un feedback existant (réponse du client à une demande employé).
   * Passe le statut à RESOLU.
   */
  async submitContent(id: number, data: { content: string; sentiment?: string; category?: string; score?: number }) {
    return this.prisma.feedback.update({
      where: { id },
      data: {
        content: data.content,
        sentiment: data.sentiment ?? null,
        category: data.category ?? null,
        score: data.score ?? null,
        status: FeedbackStatus.EN_COURS,
      },
    });
  }

  /**
   * Calcule les statistiques de feedbacks pour un client.
   * @param {number} clientId - L'identifiant du client.
   * @returns {Promise<{total: number, resolved: number, pending: number}>} Un objet de statistiques.
   */
  async getStats(clientId: number) {
    // Comptage du nombre total de feedbacks pour ce client
    const total = await this.prisma.feedback.count({
      where: { clientId },
    });
    
    // Comptage des feedbacks résolus pour ce client
    const resolved = await this.prisma.feedback.count({
      where: { clientId, status: 'RESOLU' },
    });
    
    return {
      total,
      resolved,
      pending: total - resolved, // Calcul des feedbacks en attente
    };
  }
}
