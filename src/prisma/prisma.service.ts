import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  async onModuleInit() {
    await this.$connect();
    console.log('✅ Prisma connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🛑 Prisma disconnected');
  }

  async onApplicationShutdown() {
    await this.$disconnect();
    console.log('🚀 Prisma disconnected on app shutdown');
  }
}
