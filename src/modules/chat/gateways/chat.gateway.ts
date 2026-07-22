import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from '../services/chat.service';
import { Inject, forwardRef, Logger } from '@nestjs/common';

/**
 * This gateway handles real-time communication using Socket.io and manages 
 * user rooms based on conversationId. It ensures efficient bidirectional 
 * socket flow between the client and server.
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Map<userId, Set<socketId>>
  private onlineUsers: Map<number, Set<string>> = new Map();

  constructor(
    private jwtService: JwtService,
    @Inject(forwardRef(() => ChatService))
    private chatService: ChatService,
  ) {}

  /**
   * Authenticates users upon connecting using their JWT token. 
   * Tracks their online status and subsequently joins them to their specific rooms upon connecting 
   * (via explicit join events or subsequent logic) to enable real-time message delivery.
   */
  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      // Attach userId to socket for easy access
      client.data.userId = userId;

      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
        // Broadcast user came online
        this.server.emit('presence:update', { userId, online: true });
      }
      this.onlineUsers.get(userId)!.add(client.id);
    } catch (err) {
      if ((err as Error).name === 'TokenExpiredError' || (err as Error).message.includes('jwt expired')) {
         this.logger.warn(`Connection rejected: JWT expired for client ${client.id}`);
         // Optionally you can emit a specific error event before disconnecting
         client.emit('auth_error', { message: 'jwt expired' });
      } else {
         this.logger.error(`Connection error: ${(err as Error).message}`);
      }
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const userSockets = this.onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.onlineUsers.delete(userId);
          // Broadcast user went offline
          this.server.emit('presence:update', { userId, online: false });
        }
      }
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.split(' ')[1];
    const authToken = client.handshake.auth?.token;
    if (authToken) return authToken;
    const queryToken = client.handshake.query?.token as string;
    if (queryToken) return queryToken;
    const cookieHeader = client.handshake.headers.cookie || '';
    const match = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    return null;
  }

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: number,
  ) {
    client.join(`conversation:${conversationId}`);
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { 
      conversationId: number; 
      content?: string; 
      replyToId?: number;
      fileUrl?: string;
      fileType?: string;
      fileName?: string;
    },
  ) {
    const userId = Number(client.data['userId']);
    try {
      await this.chatService.sendMessage(
        data.conversationId,
        userId,
        data.content,
        data.replyToId,
        data.fileUrl,
        data.fileType,
        data.fileName
      );
    } catch (err) {
      this.logger.error(`SendMessage error: ${(err as Error).message}`);
      client.emit('error', { message: 'Something went wrong' });
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: number,
  ) {
    const userId = client.data.userId;
    this.server
      .to(`conversation:${conversationId}`)
      .emit('typing:start', { userId, conversationId });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: number,
  ) {
    const userId = client.data.userId;
    this.server
      .to(`conversation:${conversationId}`)
      .emit('typing:stop', { userId, conversationId });
  }

  @SubscribeMessage('message:read')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: number,
  ) {
    const userId = client.data.userId;
    try {
      await this.chatService.markConversationRead(conversationId, userId);
    } catch (err) {
      this.logger.error(`MessageRead error: ${(err as Error).message}`);
      client.emit('error', { message: 'Something went wrong' });
    }
  }

  @SubscribeMessage('presence:get')
  handleGetPresence(@ConnectedSocket() client: Socket) {
    const onlineIds = Array.from(this.onlineUsers.keys());
    client.emit('presence:list', onlineIds);
  }

  /**
   * Broadcasts a new message object to all clients currently joined to the 
   * specific conversationId room.
   */
  public emitNewMessage(conversationId: number, message: any) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('message:new', message);
  }

  /**
   * Synchronizes UI states (like seen indicators or message removal) across all 
   * active participants in real-time when a user marks a conversation as read.
   */
  public emitMessageRead(conversationId: number, userId: number) {
    this.server.to(`conversation:${conversationId}`).emit('message:read', { conversationId, userId });
  }

  /**
   * Synchronizes UI states across all active participants in real-time 
   * when a user edits a message.
   */
  public emitMessageUpdated(conversationId: number, message: any) {
    this.server.to(`conversation:${conversationId}`).emit('message:updated', message);
  }

  /**
   * Synchronizes UI states (like seen indicators or message removal) across all 
   * active participants in real-time when a user deletes a message.
   */
  public emitMessageDeleted(conversationId: number, messageId: number) {
    this.server.to(`conversation:${conversationId}`).emit('message:deleted', { conversationId, messageId });
  }
}
