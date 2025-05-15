import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/src/app.module';
import cookieParser from 'cookie-parser';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:1234', // or your actual frontend URL
    credentials: true,
  });
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
