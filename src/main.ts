import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';

async function bootstrap() {
  // Créer les dossiers s'ils n'existent pas
  const baseDir = join(process.cwd(), 'uploads');
  ['avatars', 'chat'].forEach((sub) => {
    const dir = join(baseDir, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configuration des fichiers statiques
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    setHeaders: (res, path, stat) => {
      res.set('Access-Control-Allow-Origin', 'http://localhost:3000');
      res.set('Access-Control-Expose-Headers', 'Content-Disposition');
    },
  });

  // Activation CORS
  app.enableCors({
    origin: 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  // Validation globale (important pour DTO)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Prefix global API
  app.setGlobalPrefix('api');

  await app.listen(3001);
  console.log('🚀 Server running on http://localhost:3001/api');
}

bootstrap();
