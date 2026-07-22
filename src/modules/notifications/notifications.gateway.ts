import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: '*' },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // Map<userId, Set<socketId>>
  private onlineUsers: Map<number, Set<string>> = new Map();

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      client.data.userId = userId;

      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
      }
      this.onlineUsers.get(userId)!.add(client.id);

      this.logger.log(`User ${userId} connected to /notifications (socket ${client.id})`);
    } catch (err) {
      if ((err as Error).name === 'TokenExpiredError' || (err as Error).message.includes('jwt expired')) {
        this.logger.warn(`Connection rejected: JWT expired for client ${client.id}`);
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
        }
      }
      this.logger.log(`User ${userId} disconnected from /notifications (socket ${client.id})`);
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

  /**
   * Emits a force_logout event to all active sockets of the given user.
   * Called when an admin suspends a user account.
   */
  public forceLogout(userId: number): void {
    const userSockets = this.onlineUsers.get(userId);
    if (!userSockets || userSockets.size === 0) return;

    for (const socketId of userSockets) {
      this.server.to(socketId).emit('force_logout', {
        message: 'Your account has been suspended.',
      });
    }
    this.logger.log(`force_logout emitted to user ${userId} (${userSockets.size} socket(s))`);
  }

  /**
   * Emits a notification:new event to all active sockets of the given user.
   * Called by NotificationsService after persisting a notification to the DB.
   */
  public sendNotificationToUser(utilisateurId: number, notification: any): void {
    const userSockets = this.onlineUsers.get(utilisateurId);
    if (!userSockets || userSockets.size === 0) return;

    for (const socketId of userSockets) {
      this.server.to(socketId).emit('notification:new', notification);
    }
  }
}
