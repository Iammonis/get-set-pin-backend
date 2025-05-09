import {
  Injectable,
  Logger,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

import { PrismaService } from '@/src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { User } from '@/src/types/global.types';
import { v4 as uuidv4 } from 'uuid';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async createUser(
    email: string,
    password: string,
  ): Promise<{
    user: Pick<
      User,
      'id' | 'email' | 'createdAt' | 'updatedAt' | 'deactivatedAt'
    >;
    accessToken: string;
  }> {
    try {
      this.logger.log(`Checking if email already exists: ${email}`);

      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        this.logger.error(`User with this email already exists: ${email}`);
        throw new ConflictException('User with this email already exists');
      }

      this.logger.log(`Creating new user: ${email}`);
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          deactivatedAt: true,
        },
      });

      const accessToken = this.jwtService.sign({
        userId: user.id,
        email: user.email,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          deactivatedAt: user.deactivatedAt,
        },
        accessToken,
      };
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        throw error; // ✅ Properly return ConflictException instead of 500 error
      } else {
        this.logger.error(
          `Error creating user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        throw new InternalServerErrorException('User creation failed');
      }
    }
  }

  async loginUser(
    email: string,
    password: string,
  ): Promise<{
    user: Pick<
      User,
      'id' | 'email' | 'createdAt' | 'updatedAt' | 'deactivatedAt'
    >;
    accessToken: string;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          password: true, // ✅ Ensure password is selected for authentication
          createdAt: true,
          updatedAt: true, // ✅ Ensure this field is selected
          deactivatedAt: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password'); // ✅ Return proper exception
      }

      const accessToken = this.jwtService.sign({
        userId: user.id,
        email: user.email,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          deactivatedAt: user.deactivatedAt,
        },
        accessToken,
      };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error; // ✅ Ensure proper HTTP status code (401)
      }
      this.logger.error(
        `Login error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException('Login failed');
    }
  }
  auth;
  async requestPasswordReset(email: string): Promise<string> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const resetToken = uuidv4();
      await this.prisma.user.update({
        where: { email },
        data: { resetToken },
      });

      return resetToken;
    } catch (error: unknown) {
      this.logger.error(
        `Password reset request error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException('Password reset request failed');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<User> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { resetToken: token },
      });

      if (!user) {
        throw new NotFoundException('Invalid or expired reset token');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await this.prisma.user.update({
        where: { resetToken: token },
        data: {
          password: hashedPassword,
          resetToken: null,
        },
      });

      return user;
    } catch (error: unknown) {
      this.logger.error(
        `Password reset error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException('Password reset failed');
    }
  }

  async updateUserProfile(
    userId: string,
    email?: string,
    password?: string,
  ): Promise<User> {
    try {
      const data: { email?: string; password?: string } = {};

      if (email) {
        data.email = email;
      }

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        data.password = hashedPassword;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data,
      });

      return updatedUser;
    } catch (error: unknown) {
      this.logger.error(
        `Profile update error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException('User profile update failed');
    }
  }

  async deactivateUser(userId: string): Promise<User> {
    try {
      const deactivatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { deactivatedAt: new Date() },
      });

      return deactivatedUser;
    } catch (error: unknown) {
      this.logger.error(
        `User deactivation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException('User deactivation failed');
    }
  }
}
