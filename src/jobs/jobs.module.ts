import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // ✅ Import ConfigModule
import { BullModule } from '@nestjs/bullmq';
import { PinJobProcessor } from '@/src/jobs/pin-job.processor';
import { PinterestService } from '@/src/pinterest/pinterest.service';
import { PrismaService } from '@/src/prisma/prisma.service';

@Module({
  imports: [
    ConfigModule, // ✅ Ensure ConfigService is available
    BullModule.registerQueue({
      name: 'pinQueue',
      defaultJobOptions: {
        attempts: 3, // ✅ Retry failed jobs 3 times
        backoff: { type: 'exponential', delay: 60000 }, // ✅ Wait 60s before retrying
      },
    }),
  ],
  providers: [PinJobProcessor, PinterestService, PrismaService],
})
export class JobsModule {}
