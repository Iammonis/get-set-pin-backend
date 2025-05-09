import { Module } from '@nestjs/common';
import { UsersService } from '@/src/users/users.service';
import { UsersController } from '@/src/users/users.controller';
import { PrismaService } from '@/src/prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from '@/src/auth/auth.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // ✅ Ensure ConfigModule is globally available
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, PrismaService, AuthService], // ✅ Removed ConfigService from providers
  exports: [UsersService, JwtModule], // ✅ No need to export ConfigModule since it's global
})
export class UsersModule {}
