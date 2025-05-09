import { Module } from '@nestjs/common';
import { PinterestController } from '@/src/pinterest/pinterest.controller';
import { PinterestService } from '@/src/pinterest/pinterest.service';
import { PrismaService } from '@/src/prisma/prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'pinQueue', // ✅ Ensure this matches the queue name in `PinterestService`
    }),
  ],
  controllers: [PinterestController],
  providers: [PinterestService, PrismaService, ConfigService],
  exports: [PinterestService],
})
export class PinterestModule {}
