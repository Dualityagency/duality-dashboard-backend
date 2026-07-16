import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConversationType, Prisma } from '@prisma/client';

@Injectable()
export class ChatRepository {
  constructor(private prisma: PrismaService) { }

  async findUserRole(userId: number): Promise<string | null> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role ?? null;
  }

  async findConversationsByUserId(userId: number) {
    return this.prisma.conversation.findMany({
      where: {
        type: ConversationType.DIRECT,
        participants: {
          some: { utilisateurId: userId },
        },
      },
      include: {
        participants: {
          select: { utilisateurId: true, lastReadAt: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            isEdited: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
            replyToId: true,
            fileUrl: true,
            fileType: true,
            fileName: true,
            senderId: true,
            conversationId: true,
            sender: {
              select: { id: true, nom: true, prenom: true, avatar: true },
            },
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async findProjectConversationsForUser(userId: number) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: {
        role: true,
        client: { select: { id: true } },
        employee: { select: { id: true } },
      },
    });

    if (!user) return [];

    let projectIds: number[] = [];

    // Admins see all project conversations
    if (user.role === 'ADMIN') {
      const allProjects = await this.prisma.project.findMany({
        select: { id: true },
      });
      projectIds = allProjects.map((p) => p.id);
    } else if (user.role === 'CLIENT' && user.client) {
      const clientProjects = await this.prisma.project.findMany({
        where: { clientId: user.client.id },
        select: { id: true },
      });
      projectIds = clientProjects.map((p) => p.id);
    } else if (user.role === 'EMPLOYEE' && user.employee) {
      const employeeEquipes = await this.prisma.equipe.findMany({
        where: { employeeId: user.employee.id },
        select: { projectId: true },
      });
      projectIds = employeeEquipes.map((e) => e.projectId);
    }

    if (projectIds.length === 0) return [];

    return this.prisma.conversation.findMany({
      where: {
        type: ConversationType.PROJECT,
        projectId: { in: projectIds },
      },
      include: {
        project: {
          select: { nom: true },
        },
        participants: {
          include: {
            utilisateur: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                avatar: true,
                role: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            isEdited: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
            replyToId: true,
            fileUrl: true,
            fileType: true,
            fileName: true,
            senderId: true,
            conversationId: true,
            sender: {
              select: { id: true, nom: true, prenom: true, avatar: true },
            },
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async findDirectConversation(userId1: number, userId2: number) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        AND: [
          { participants: { some: { utilisateurId: userId1 } } },
          { participants: { some: { utilisateurId: userId2 } } },
        ],
      },
      include: {
        participants: {
          select: { utilisateurId: true, lastReadAt: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            isEdited: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
            replyToId: true,
            fileUrl: true,
            fileType: true,
            fileName: true,
            senderId: true,
            conversationId: true,
            sender: {
              select: { id: true, nom: true, prenom: true, avatar: true },
            },
          },
        },
      },
    });

    if (conversation) {
      const { messages, ...rest } = conversation;
      return {
        ...rest,
        lastMessage: messages[0] || null,
      };
    }
    return null;
  }

  async createDirectConversation(creatorId: number, otherUserId: number) {
    const conversation = await this.prisma.conversation.create({
      data: {
        type: ConversationType.DIRECT,
        createdBy: creatorId,
        participants: {
          create: [
            { utilisateurId: creatorId },
            { utilisateurId: otherUserId },
          ],
        },
      },
      include: {
        participants: {
          select: { utilisateurId: true, lastReadAt: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            isEdited: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
            replyToId: true,
            fileUrl: true,
            fileType: true,
            fileName: true,
            senderId: true,
            conversationId: true,
            sender: {
              select: { id: true, nom: true, prenom: true, avatar: true },
            },
          },
        },
      },
    });

    const { messages, ...rest } = conversation;
    return {
      ...rest,
      lastMessage: messages[0] || null,
    };
  }

  async countUnreadMessagesByConversationIds(
    conversationIds: number[],
    userId: number,
  ) {
    // 1. Initialize all requested conversationIds to 0
    const counts: Record<number, number> = {};
    for (const id of conversationIds) {
      counts[id] = 0;
    }

    if (conversationIds.length === 0) return counts;

    // 2. Query to find unread counts safely across all conversation types
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT m."conversationId", COUNT(m.id)::int as "unreadCount"
      FROM messages m
      LEFT JOIN conversation_participants cp 
        ON m."conversationId" = cp."conversationId" 
        AND cp."utilisateurId" = ${userId}
      WHERE m."conversationId" IN (${Prisma.join(conversationIds)})
        AND m."senderId" != ${userId}
        AND m."deletedAt" IS NULL
        AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
      GROUP BY m."conversationId"
    `;

    // 3. Populate the actual counts found
    for (const row of result) {
      counts[Number(row.conversationId)] = Number(row.unreadCount);
    }

    return counts;
  }

  async findMessagesByConversationId(
    conversationId: number,
    userId: number,
    cursor?: number,
    limit: number = 50,
  ) {
    return this.prisma.message.findMany({
      where: {
        conversationId,
      },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, nom: true, prenom: true, avatar: true },
        },
      },
    });
  }

  async findParticipant(conversationId: number, userId: number) {
    return this.prisma.conversationParticipant.findUnique({
      where: {
        utilisateurId_conversationId: {
          conversationId,
          utilisateurId: userId,
        },
      },
    });
  }

  async createMessage(
    conversationId: number,
    senderId: number,
    content: string,
    replyToId?: number,
    fileUrl?: string,
    fileType?: string,
    fileName?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId,
          senderId,
          content,
          replyToId,
          fileUrl,
          fileType,
          fileName,
        },
        include: {
          sender: {
            select: { id: true, nom: true, prenom: true, avatar: true },
          },
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      // Before updating lastReadAt, check if the participant record exists
      const participantExists = await tx.conversationParticipant.findUnique({
        where: {
          utilisateurId_conversationId: {
            conversationId,
            utilisateurId: senderId,
          },
        },
      });

      if (participantExists) {
        await tx.conversationParticipant.update({
          where: {
            utilisateurId_conversationId: {
              conversationId,
              utilisateurId: senderId,
            },
          },
          data: { lastReadAt: message.createdAt },
        });
      }

      return message;
    });
  }

  async findUnreadMessages(conversationId: number, userId: number) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        utilisateurId_conversationId: {
          conversationId,
          utilisateurId: userId,
        },
      },
    });

    if (!participant) return [];

    return this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        senderId: { not: userId },
        ...(participant.lastReadAt
          ? { createdAt: { gt: participant.lastReadAt } }
          : {}),
      },
      select: { id: true },
    });
  }

  async updateParticipantLastReadAt(conversationId: number, userId: number) {
    return this.prisma.conversationParticipant.update({
      where: {
        utilisateurId_conversationId: {
          conversationId,
          utilisateurId: userId,
        },
      },
      data: { lastReadAt: new Date() },
    });
  }

  async upsertParticipant(conversationId: number, userId: number) {
    return this.prisma.conversationParticipant.upsert({
      where: {
        utilisateurId_conversationId: {
          conversationId,
          utilisateurId: userId,
        },
      },
      update: { lastReadAt: new Date() },
      create: {
        conversationId,
        utilisateurId: userId,
        lastReadAt: new Date(),
      },
    });
  }

  async softDeleteMessage(messageId: number) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
  }

  async updateMessage(messageId: number, content: string) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: { content, isEdited: true },
      include: {
        sender: {
          select: { id: true, nom: true, prenom: true, avatar: true },
        },
      },
    });
  }

  async findMessageById(messageId: number) {
    return this.prisma.message.findUnique({
      where: { id: messageId },
    });
  }

  async findFilteredContacts(userId: number) {
    const currentUser = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!currentUser) {
      return [];
    }

    const baseSelect = {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      avatar: true,
      role: true,
      status: true,
    };

    const activeUsersFilter = {
      status: { not: 'SUSPENDU' as const },
      id: { not: userId },
    };

    // Admins can see everyone
    if (currentUser.role === 'ADMIN') {
      return this.prisma.utilisateur.findMany({
        where: activeUsersFilter,
        select: baseSelect,
      });
    }

    // Prepare arrays to hold IDs of users to include
    const allowedUserIds = new Set<number>();

    // 1. All Admins are always included
    const admins = await this.prisma.utilisateur.findMany({
      where: { role: 'ADMIN', status: { not: 'SUSPENDU' as const } },
      select: { id: true },
    });
    admins.forEach((a) => allowedUserIds.add(a.id));

    // 2. Fetch based on role (CLIENT or EMPLOYEE)
    if (currentUser.role === 'CLIENT') {
      const clientRecord = await this.prisma.client.findUnique({
        where: { utilisateurId: userId },
        include: {
          projects: {
            include: {
              equipes: {
                include: { employee: true },
              },
            },
          },
        },
      });

      if (clientRecord) {
        clientRecord.projects.forEach((project) => {
          project.equipes.forEach((equipe) => {
            allowedUserIds.add(equipe.employee.utilisateurId);
          });
        });
      }
    } else if (currentUser.role === 'EMPLOYEE') {
      const employeeRecord = await this.prisma.employee.findUnique({
        where: { utilisateurId: userId },
        include: {
          equipes: {
            include: {
              project: {
                include: {
                  client: true,
                  equipes: {
                    include: { employee: true },
                  },
                },
              },
            },
          },
        },
      });

      if (employeeRecord) {
        employeeRecord.equipes.forEach((equipe) => {
          // Add the client of the project
          allowedUserIds.add(equipe.project.client.utilisateurId);

          // Add all other employees in the project
          equipe.project.equipes.forEach((otherEquipe) => {
            allowedUserIds.add(otherEquipe.employee.utilisateurId);
          });
        });
      }
    }

    // Ensure current user is not in the set
    allowedUserIds.delete(userId);

    if (allowedUserIds.size === 0) {
      return [];
    }

    return this.prisma.utilisateur.findMany({
      where: {
        id: { in: Array.from(allowedUserIds) },
        status: { not: 'SUSPENDU' as const },
      },
      select: baseSelect,
    });
  }
}
