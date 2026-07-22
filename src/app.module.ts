/**
 * @file app.module.ts
 * @description Module racine de l'application NestJS. Centralise tous les modules fonctionnels et d'infrastructure.
 * @feature Racine de l'application
 */

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from './modules/users/users.module';
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { ClientFeedbackModule } from './modules/client-feedback/client-feedback.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { ClientsModule } from './modules/clients/clients.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SprintsModule } from './modules/sprints/sprints.module';

/**
 * Module principal de l'application.
 * @Module Déclare les imports, contrôleurs et fournisseurs globaux.
 */
@Module({
  imports: [
    // Configuration globale des variables d'environnement (.env)
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    // Service de fichiers statiques pour servir les fichiers uploadés (images, documents)
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    // Modules d'infrastructure et fonctionnels
    PrismaModule,
    UsersModule,
    MailModule,
    AuthModule,
    ChatModule,
    ClientFeedbackModule,
    ClientsModule,
    EmployeesModule,
    ProjectsModule,
    DashboardModule,
    AnalyticsModule, 
    TasksModule,
    SprintsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
