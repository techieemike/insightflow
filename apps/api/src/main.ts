import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' });
  await app.listen(process.env.PORT || 3001);
  console.log('InsightFlow API running on http://localhost:3001');
}
bootstrap();