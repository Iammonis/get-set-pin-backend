import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/src/app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.setGlobalPrefix('api');

  try {
    await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
    console.log(
      `Server is running on http://localhost:${process.env.PORT ?? 3000}/api`,
    );
  } catch (error) {
    console.error('Error starting the server:', error);
    process.exit(1);
  }
}

void bootstrap();
