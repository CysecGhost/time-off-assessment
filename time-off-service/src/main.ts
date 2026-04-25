import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = NestFactory.create(AppModule);
  (await app).useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await (await app).listen(3000);
}
bootstrap();
