import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async createNotification(
    utilisateurId: number,
    type: NotificationType,
    titre: string,
    description: string,
    relatedEntityId?: number,
    relatedEntityType?: string,
    additionalEntityId?: number,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        utilisateurId,
        type,
        titre,
        description,
        etat: 'NON_LUE',
        ...(relatedEntityId !== undefined ? { relatedEntityId } : {}),
        ...(relatedEntityType !== undefined ? { relatedEntityType } : {}),
        ...(additionalEntityId !== undefined ? { additionalEntityId } : {}),
      },
    });

    // Push to connected client in real time
    this.notificationsGateway.sendNotificationToUser(utilisateurId, notification);

    return notification;
  }

  async getNotificationsForUser(utilisateurId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { utilisateurId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { utilisateurId } }),
    ]);

    return {
      data: notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markAsRead(notificationId: number, utilisateurId: number) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, utilisateurId },
      data: { etat: 'LUE' },
    });
  }

  async markAllAsRead(utilisateurId: number) {
    return this.prisma.notification.updateMany({
      where: { utilisateurId, etat: 'NON_LUE' },
      data: { etat: 'LUE' },
    });
  }

  async getUnreadCount(utilisateurId: number): Promise<number> {
    return this.prisma.notification.count({
      where: { utilisateurId, etat: 'NON_LUE' },
    });
  }
}
