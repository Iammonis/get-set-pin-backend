import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinterestService } from '@/src/pinterest/pinterest.service';

@Processor('token-refresh')
export class TokenRefreshJob extends WorkerHost {
  constructor(private readonly pinterestService: PinterestService) {
    super();
  }

  async process(
    job: Job<{ userId: string; pinterestId: string }>,
  ): Promise<void> {
    const { userId, pinterestId } = job.data;
    await this.pinterestService.refreshAccessToken(userId, pinterestId);
  }
}
