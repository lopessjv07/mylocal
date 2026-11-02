import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

// Permite serializar BigInt caso algum campo passe direto pelo JSON.stringify
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  const port = Number(process.env.BACKEND_PORT || 4000);
  await app.listen(port);
  logger.log(`MyLibrary Cloud Backend rodando em http://localhost:${port}`);
}
bootstrap();

