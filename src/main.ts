/**
 * @file main.ts
 * @description Point d'entrée principal de l'application NestJS. Configure le serveur, les middlewares globaux et les paramètres de sécurité.
 * @feature Bootstrapping de l'application
 */

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

/**
 * Fonction de démarrage de l'application.
 */
async function bootstrap() {
  // Création récursive des dossiers d'uploads s'ils n'existent pas (avatars, documents chat)
  const baseDir = join(process.cwd(), 'uploads');
  ['avatars', 'chat'].forEach((sub) => {
    const dir = join(baseDir, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Initialisation de l'application NestJS avec Express
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /**
   * Configuration des fichiers statiques.
   * Permet d'accéder aux fichiers via http://domaine.com/uploads/...
   */
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    setHeaders: (res) => {
      res.set('Access-Control-Allow-Origin', corsOrigin);
      res.set('Access-Control-Expose-Headers', 'Content-Disposition');
    },
  });

  app.use(cookieParser());
  app.use(helmet());

  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  /**
   * Activation de la validation globale via les DTOs.
   * @ValidationPipe Filtre les données entrantes et transforme les types.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les propriétés non déclarées dans le DTO
      forbidNonWhitelisted: true, // Rejette la requête si des propriétés inconnues sont présentes
      transform: true, // Convertit automatiquement les types (ex: string vers number)
    }),
  );

  // Définition d'un préfixe global pour toutes les routes API
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setGlobalPrefix('api');

  // Lancement du serveur sur le port 3001
  await app.listen(3001);
  console.log('🚀 Server running on http://localhost:3001/api');
}

// Lancement du processus bootstrap
bootstrap();
