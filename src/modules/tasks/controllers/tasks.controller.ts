import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, basename } from 'path';
import type { Response } from 'express';
import { existsSync } from 'fs';
import { TasksService } from '../services/tasks.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { AuthenticatedRequest } from '../../../common/types/authenticated-request';
import { StartTimerDto, TaskType } from '../dto/start-timer.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { UpdateSprintTaskDto } from '../dto/update-sprint-task.dto';
import { CreateSprintTaskDto } from '../dto/create-sprint-task.dto';
import { AskAiDto } from '../dto/ask-ai.dto';
import { GetTasksDto } from '../dto/get-tasks.dto';
import { BadRequestException } from '@nestjs/common';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.EMPLOYEE, Role.ADMIN)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // ── Static GET routes ──────────────────────────────────────────────────────

  @Get()
  async getTasks(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetTasksDto,
  ) {
    return this.tasksService.getTasks(req.user.id, query);
  }

  @Get('projects')
  async getProjects(@Req() req: AuthenticatedRequest) {
    return this.tasksService.getProjectsForEmployee(req.user.id);
  }

  @Get('time-tracking')
  async getTimeTracking(@Req() req: AuthenticatedRequest) {
    return this.tasksService.getTimeTrackingStats(req.user.id);
  }

  @Get('download/:filename')
  async downloadFile(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const safeFilename = basename(filename);
    const filePath = join(process.cwd(), 'uploads', 'tasks', safeFilename);
    if (!existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    res.download(filePath);
  }

  @Get('sprint/download/:filename')
  async downloadSprintFile(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const safeFilename = basename(filename);
    const filePath = join(process.cwd(), 'uploads', 'tasks', safeFilename);
    if (!existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    res.download(filePath);
  }

  // ── Parameterized GET routes ───────────────────────────────────────────────

  @Get('projects/:id/members')
  async getProjectMembers(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.getTeamMembersForProject(id, req.user.id);
  }

  // ── Static POST routes ─────────────────────────────────────────────────────

  @Post()
  async createTask(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.createTask(dto, req.user.id);
  }

  @Post('ai/ask')
  async askAI(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AskAiDto,
  ) {
    return this.tasksService.askAI(dto, req.user.id);
  }

  @Post('sprint')
  async createSprintTask(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSprintTaskDto,
  ) {
    return this.tasksService.createSprintTask(dto, req.user.id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/tasks',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'image/png',
          'image/jpeg',
          'image/jpg',
        ];
        cb(null, allowedMimeTypes.includes(file.mimetype));
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
    @Body('taskId') taskId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded or invalid file type');
    }

    const fileData = {
      fileUrl: `/uploads/tasks/${file.filename}`,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
    };

    if (taskId) {
      const parsedTaskId = parseInt(taskId, 10);
      if (!isNaN(parsedTaskId)) {
        await this.tasksService.verifyTaskAccess(parsedTaskId, req.user.id, TaskType.MARKETING);
        const dbFile = await this.tasksService.attachFileToTask(parsedTaskId, file);
        return { ...fileData, id: dbFile.id };
      }
    }

    return fileData;
  }

  // ── Parameterized POST routes ──────────────────────────────────────────────

  @Post('sprint/:id/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/tasks',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadSprintFile(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) sprintTaskId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded or invalid file type');
    }

    await this.tasksService.verifyTaskAccess(sprintTaskId, req.user.id, TaskType.SPRINT);
    const dbFile = await this.tasksService.attachFileToSprintTask(sprintTaskId, file);
    return {
      fileUrl: `/uploads/tasks/${file.filename}`,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      id: dbFile.id,
    };
  }

  @Post(':id/start')
  async startTimer(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StartTimerDto,
  ) {
    return this.tasksService.startTimer(id, dto.type, req.user.id);
  }

  @Post(':id/stop')
  async stopTimer(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) taskId: number,
    @Body() dto: StartTimerDto,
  ) {
    return this.tasksService.stopTimer(taskId, dto.type, req.user.id);
  }

  @Get(':id/feedback')
  async getTaskFeedback(
    @Param('id', ParseIntPipe) taskId: number,
  ) {
    return this.tasksService.getTaskFeedback(taskId);
  }

  @Post(':id/request-feedback')
  async requestFeedback(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) taskId: number,
  ) {
    return this.tasksService.requestFeedback(taskId, req.user.id);
  }

  @Patch(':id/feedback/resolve')
  async resolveFeedback(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) taskId: number,
  ) {
    return this.tasksService.resolveFeedback(taskId, req.user.id);
  }

  // ── PATCH routes ───────────────────────────────────────────────────────────

  @Patch('sprint/:id')
  async updateSprintTask(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSprintTaskDto,
  ) {
    return this.tasksService.updateSprintTask(id, dto, req.user.id, req.user.role);
  }

  @Patch(':id')
  async updateTask(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(id, dto, req.user.id, req.user.role);
  }

  // ── DELETE routes ──────────────────────────────────────────────────────────

  @Delete('sprint/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSprintTask(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tasksService.deleteSprintTask(id, req.user.id, req.user.role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteTask(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tasksService.deleteTask(id, req.user.id);
  }
}
