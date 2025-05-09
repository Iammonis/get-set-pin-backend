import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from '@/src/app.controller';
import { AppService } from '@/src/app.service';
import { UsersModule } from '@/src/users/users.module';
import { PinterestModule } from '@/src/pinterest/pinterest.module';
import { JobsModule } from '@/src/jobs/jobs.module';
import { PrismaModule } from '@/src/prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '@/src/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // ✅ Ensure ConfigModule is available globally
    }),
    AuthModule, // ✅ Ensure this is imported
    UsersModule,
    PinterestModule,
    JobsModule,
    PrismaModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: configService.get<number>('REDIS_PORT') || 6379,
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'pinQueue', // ✅ Ensure the queue is globally registered
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
