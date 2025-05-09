import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinterestService } from '@/src/pinterest/pinterest.service';
import { PrismaService } from '@/src/prisma/prisma.service';

@Processor('pinQueue')
export class PinJobProcessor extends WorkerHost {
  constructor(
    private readonly pinterestService: PinterestService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<{ pinId: string }>): Promise<void> {
    try {
      const pin = await this.prisma.pin.findUnique({
        where: { id: job.data.pinId },
      });

      if (!pin || pin.deletedAt) {
        console.log(`Pin ${job.data.pinId} not found or deleted. Skipping.`);
        return;
      }

      // Post the pin to Pinterest
      await this.pinterestService.createPin(
        pin.userId,
        pin.boardId,
        pin.title,
        pin.mediaType as 'image' | 'video',
        pin.imageUrl || pin.videoUrl || '',
        pin.description || '',
        pin.link || '',
        pin.richPinType as 'recipe' | 'article' | 'product',
        pin.price || undefined,
        pin.availability as 'in_stock' | 'out_of_stock' | 'preorder',
      );

      // Mark pin as posted
      await this.prisma.pin.update({
        where: { id: pin.id },
        data: { status: 'posted', updatedAt: new Date() },
      });

      console.log(`Pin ${pin.id} posted successfully.`);
    } catch (error: unknown) {
      console.error(
        `Failed to post pin ${job.data.pinId}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
