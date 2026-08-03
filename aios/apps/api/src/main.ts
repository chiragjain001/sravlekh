import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser') as () => unknown;
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());
  app.use(cookieParser());

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const port = configService.get<number>('PORT', 4000);

  // CORS — restrict to frontend origin in production
  app.enableCors({
    origin:
      nodeEnv === 'production'
        ? configService.get<string>('FRONTEND_URL', 'https://aios.app')
        : ['http://localhost:3000'],
    credentials: true,
  });

  // Global validation pipe — strips unknown fields, whitelist-validates DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix for all routes
  app.setGlobalPrefix('api/v1');

  // Swagger (only in non-production)
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AIOS API')
      .setDescription('Academic Intelligence Operating System — REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);
  console.log(`AIOS API running on port ${port} [${nodeEnv}]`);
}

void bootstrap();
