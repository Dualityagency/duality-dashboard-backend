import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ChatRepository } from '../repositories/chat.repository';
import { ChatGateway } from '../gateways/chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    private readonly chatRepository: ChatRepository,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async getContactList(userId: number) {
    const allUsers = await this.chatRepository.findFilteredContacts(userId);
    const conversations =
      await this.chatRepository.findConversationsByUserId(userId);

    const conversationIds = conversations.map((c) => c.id);
    const unreadCounts =
      await this.chatRepository.countUnreadMessagesByConversationIds(
        conversationIds,
        userId,
      );

    return allUsers.map((user) => {
      const conv = conversations.find((c) =>
        c.participants.some((p) => p.utilisateurId === user.id),
      );

      const unreadCount = conv ? unreadCounts[conv.id] || 0 : 0;
      let lastMessage = conv?.messages[0] || null;

      if (lastMessage && lastMessage.deletedAt) {
        lastMessage = {
          ...lastMessage,
          content: "L'utilisateur a supprimé ce message",
        };
      } else if (lastMessage && (!lastMessage.content || lastMessage.content.trim() === '') && lastMessage.fileUrl) {
        const isImage = lastMessage.fileType && lastMessage.fileType.startsWith('image/');
        lastMessage = {
          ...lastMessage,
          content: isImage ? '📷 Image' : '📎 Fichier',
        };
      }

      return {
        user,
        conversationId: conv?.id || null,
        lastMessage,
        unreadCount,
      };
    });
  }

  async getOrCreateDirectConversation(
    currentUserId: number,
    otherUserId: number,
  ) {
    let conversation = await this.chatRepository.findDirectConversation(
      currentUserId,
      otherUserId,
    );

    if (!conversation) {
      conversation = await this.chatRepository.createDirectConversation(
        currentUserId,
        otherUserId,
      );
    }

    return conversation;
  }

  async listConversations(userId: number) {
    const conversations =
      await this.chatRepository.findConversationsByUserId(userId);
    const conversationIds = conversations.map((c) => c.id);
    const unreadCounts =
      await this.chatRepository.countUnreadMessagesByConversationIds(
        conversationIds,
        userId,
      );

    return conversations.map((conv) => {
      const { messages, ...rest } = conv;
      let lastMessage = messages[0] || null;

      if (lastMessage && lastMessage.deletedAt) {
        lastMessage = {
          ...lastMessage,
          content: "L'utilisateur a supprimé ce message",
        };
      } else if (lastMessage && (!lastMessage.content || lastMessage.content.trim() === '') && lastMessage.fileUrl) {
        const isImage = lastMessage.fileType && lastMessage.fileType.startsWith('image/');
        lastMessage = {
          ...lastMessage,
          content: isImage ? '📷 Image' : '📎 Fichier',
        };
      }

      return {
        ...rest,
        lastMessage,
        unreadCount: unreadCounts[conv.id] || 0,
      };
    });
  }

  async listProjectConversations(userId: number) {
    // 1. Let the repository fetch all matching project conversations
    const projectConversations =
      await this.chatRepository.findProjectConversationsForUser(userId);

    // 2. We can get the unread counts as well
    const conversationIds = projectConversations.map((c) => c.id);
    const unreadCounts =
      await this.chatRepository.countUnreadMessagesByConversationIds(
        conversationIds,
        userId,
      );

    // 3. Map to frontend expected shape: { id, projectName, lastMessage, participants, unreadCount }
    return projectConversations.map((conv) => {
      const { messages, project, participants, ...rest } = conv;
      let lastMessage = messages[0] || null;

      if (lastMessage && lastMessage.deletedAt) {
        lastMessage = {
          ...lastMessage,
          content: "L'utilisateur a supprimé ce message",
        };
      } else if (lastMessage && (!lastMessage.content || lastMessage.content.trim() === '') && lastMessage.fileUrl) {
        const isImage = lastMessage.fileType && lastMessage.fileType.startsWith('image/');
        lastMessage = {
          ...lastMessage,
          content: isImage ? '📷 Image' : '📎 Fichier',
        };
      }

      return {
        ...rest,
        projectName: project?.nom || 'Unknown Project',
        lastMessage,
        participants: participants.map((p) => p.utilisateur),
        unreadCount: unreadCounts[conv.id] || 0,
      };
    });
  }

  async listMessages(
    conversationId: number,
    userId: number,
    cursor?: number,
    limit?: number,
  ) {
    const role = await this.chatRepository.findUserRole(userId);
    if (role !== 'ADMIN') {
      const participant = await this.chatRepository.findParticipant(
        conversationId,
        userId,
      );
      if (!participant) {
        throw new ForbiddenException(
          'You are not a participant in this conversation',
        );
      }
    }

    const messages = await this.chatRepository.findMessagesByConversationId(
      conversationId,
      userId,
      cursor,
      limit,
    );

    return messages.map(msg => {
      if (msg.deletedAt) {
        return {
          ...msg,
          content: "L'utilisateur a supprimé ce message",
        };
      }
      return msg;
    });
  }

  async sendMessage(
    conversationId: number,
    senderId: number,
    content?: string,
    replyToId?: number,
    fileUrl?: string,
    fileType?: string,
    fileName?: string,
  ) {
    const role = await this.chatRepository.findUserRole(senderId);
    if (role !== 'ADMIN') {
      const participant = await this.chatRepository.findParticipant(
        conversationId,
        senderId,
      );
      if (!participant) {
        throw new ForbiddenException(
          'You are not a participant in this conversation',
        );
      }
    }

    const message = await this.chatRepository.createMessage(
      conversationId,
      senderId,
      content || '',
      replyToId,
      fileUrl,
      fileType,
      fileName,
    );

    // Triggering the gateway to notify all participants of the new message after successful database persistence.
    this.chatGateway.emitNewMessage(conversationId, message);

    return message;
  }

  async markConversationRead(conversationId: number, userId: number) {
    const role = await this.chatRepository.findUserRole(userId);
    const participant = await this.chatRepository.findParticipant(conversationId, userId);

    if (!participant && role !== 'ADMIN') {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    if (!participant) {
      await this.chatRepository.upsertParticipant(conversationId, userId);
    } else {
      await this.chatRepository.updateParticipantLastReadAt(conversationId, userId);
    }

    this.chatGateway.emitMessageRead(conversationId, userId);
    return { success: true };
  }

  async editMessage(messageId: number, userId: number, content: string) {
    const message = await this.chatRepository.findMessageById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.deletedAt) {
      throw new ForbiddenException('Cannot edit a deleted message');
    }

    const role = await this.chatRepository.findUserRole(userId);
    if (role !== 'ADMIN' && message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    const updatedMessage = await this.chatRepository.updateMessage(messageId, content);

    // Triggering the gateway to synchronize the edited message across all active participants' UI in real-time.
    this.chatGateway.emitMessageUpdated(updatedMessage.conversationId, updatedMessage);
    
    return updatedMessage;
  }

  async deleteMessage(messageId: number, userId: number) {
    const message = await this.chatRepository.findMessageById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.deletedAt) {
      return { success: true }; // Already deleted
    }

    const role = await this.chatRepository.findUserRole(userId);
    if (role !== 'ADMIN' && message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.chatRepository.softDeleteMessage(messageId);

    // Triggering the gateway to inform all participants of the deleted message, enabling immediate UI updates.
    this.chatGateway.emitMessageDeleted(message.conversationId, messageId);

    return { success: true };
  }
}
