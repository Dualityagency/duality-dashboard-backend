import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ChatService } from '../services/chat.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateDirectDto } from '../dto/create-direct.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { EditMessageDto } from '../dto/edit-message.dto';
import { PaginationDto } from '../dto/pagination.dto';

import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('contacts')
  @Roles(Role.ADMIN, Role.EMPLOYEE, Role.CLIENT)
  async getContactList(@Req() req: { user: { id: number } }) {
    return this.chatService.getContactList(req.user.id);
  }

  @Get('conversations')
  @Roles(Role.ADMIN, Role.EMPLOYEE, Role.CLIENT)
  async listConversations(@Req() req: { user: { id: number } }) {
    return this.chatService.listConversations(req.user.id);
  }

  @Get('project-conversations')
  @Roles(Role.ADMIN, Role.EMPLOYEE, Role.CLIENT)
  async listProjectConversations(@Req() req: { user: { id: number } }) {
    return this.chatService.listProjectConversations(req.user.id);
  }

  @Post('direct')
@Roles(Role.ADMIN, Role.EMPLOYEE, Role.CLIENT)
  async getOrCreateDirectConversation(
    @Req() req: { user: { id: number } },
    @Body() createDirectDto: CreateDirectDto,
  ) {
    return this.chatService.getOrCreateDirectConversation(
      req.user.id,
      createDirectDto.userId,
    );
  }

  @Get('conversations/:id/messages')
  @Roles(Role.ADMIN, Role.EMPLOYEE, Role.CLIENT)
  async listMessages(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) conversationId: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.chatService.listMessages(
      conversationId,
      req.user.id,
      paginationDto.cursor,
      paginationDto.limit,
    );
  }

  @Post('conversations/:id/messages')
  @Roles(Role.ADMIN, Role.EMPLOYEE, Role.CLIENT)
  async sendMessage(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      conversationId,
      req.user.id,
      sendMessageDto.content,
      sendMessageDto.replyToId,
      sendMessageDto.fileUrl,
      sendMessageDto.fileType,
      sendMessageDto.fileName,
    );
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/chat',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return {
      fileUrl: `/uploads/chat/${file.filename}`,
      fileName: file.originalname,
      fileType: file.mimetype,
    };
  }

  @Post('conversations/:id/read')
  @Roles(Role.ADMIN, Role.EMPLOYEE, Role.CLIENT)
  async markConversationRead(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) conversationId: number,
  ) {
    return this.chatService.markConversationRead(conversationId, req.user.id);
  }

  @Patch('messages/:id')
  @Roles(Role.ADMIN, Role.EMPLOYEE, Role.CLIENT)
  async editMessage(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) messageId: number,
    @Body() editMessageDto: EditMessageDto,
  ) {
    return this.chatService.editMessage(
      messageId,
      req.user.id,
      editMessageDto.content,
    );
  }

  @Delete('messages/:id')
  @Roles(Role.ADMIN, Role.EMPLOYEE, Role.CLIENT)
  async deleteMessage(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) messageId: number,
  ) {
    return this.chatService.deleteMessage(messageId, req.user.id);
  }
}
