import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // ✅ Makes PrismaService available across all modules
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
