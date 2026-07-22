import { Controller, Get, Post, Body, UseGuards, Query, Delete, Param, Patch, UseInterceptors, UploadedFile, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProjectsService } from '../services/projects.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AIGeneratorService } from '../services/ai-generator.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('projects')
export class ProjectsController {
  constructor(
      private projectsService: ProjectsService,
      private aiGeneratorService: AIGeneratorService
  ) { }

  @Post()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async create(@Body() createProjectDto: CreateProjectDto, @GetUser('id') creatorId: number) {
    return this.projectsService.create(createProjectDto, creatorId);
  }

  @Get(':id/marketing-details')
  @Roles(Role.ADMIN, Role.EMPLOYEE, Role.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getMarketingProjectDetails(@Param('id') id: string) {
    return this.projectsService.getMarketingProjectDetails(Number(id));
  }

  @Get(':id/web-details')
  @Roles(Role.ADMIN, Role.EMPLOYEE, Role.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getWebProjectDetails(@Param('id') id: string) {
    return this.projectsService.getWebProjectDetails(Number(id));
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findOne(@Param('id') id: string) {
    return this.projectsService.findOne(Number(id));
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async update(@Param('id') id: string, @Body() data: any) {
    return this.projectsService.update(Number(id), data);
  }

  @Get()
  @Roles(Role.ADMIN, Role.EMPLOYEE, Role.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findAll(
    @GetUser() user: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string
  ) {
    let employeeId: number | undefined;
    let clientId: number | undefined;

    if (user.role === Role.EMPLOYEE && user.employee) {
      employeeId = user.employee.id;
    } else if (user.role === Role.CLIENT && user.client) {
      clientId = user.client.id;
    }

    return this.projectsService.findAll(Number(page), Number(limit), search, employeeId, clientId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async remove(@Param('id') id: string) {
    return this.projectsService.delete(Number(id));
  }

  @Post(':id/upload-cdc')
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/cahier-des-charges',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `cdc-${req.params.id}-${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (!file.originalname.match(/\.(pdf|doc|docx)$/)) {
        return cb(new BadRequestException('Seulement les fichiers PDF et Word sont autorisés !'), false);
      }
      cb(null, true);
    },
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB
    }
  }))
  async uploadCDC(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Fichier manquant');
    }
    const cdcUrl = `/uploads/cahier-des-charges/${file.filename}`;
    return this.projectsService.updateCahierDesCharges(id, cdcUrl);
  }

  @Get('employee/:employeeId')
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getByEmployee(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.projectsService.findByEmployeeId(employeeId);
  }

  @Get('admin/calendar')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAdminCalendar(
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return this.projectsService.getAdminCalendar(month, year);
  }

  @Post(':id/generate-ai-sprints')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async generateAISprints(@Param('id', ParseIntPipe) id: number) {
    return this.aiGeneratorService.generateSprints(id);
  }
}