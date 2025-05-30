import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PinterestService } from '@/src/pinterest/pinterest.service';
import { Response } from 'express';
import { UserRequest } from '@/src/types/global.types';
import { JwtAuthGuard } from '@/src/auth/jwt-auth.guard';

@Controller('pinterest')
export class PinterestController {
  constructor(private readonly pinterestService: PinterestService) {}

  private async validateUser(req: UserRequest): Promise<void> {
    console.log('Extracted User from Request:', req.user);
    if (!req.user || !req.user.userId) {
      throw new HttpException('User ID is missing', HttpStatus.UNAUTHORIZED);
    }

    await this.pinterestService.checkUserPinterestAccount(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('auth')
  redirectToPinterest(
    @Req() req: UserRequest,
    @Res({ passthrough: true }) res: Response,
  ): void {
    console.log('Controller hit: req.user =', req.user);
    const url: string = this.pinterestService.getPinterestAuthUrl(
      req.user.userId,
    );
    console.log(`Redirecting user to Pinterest OAuth: ${url}`);
    res.redirect(url);
  }

  @UseGuards(JwtAuthGuard)
  @Get('boards')
  async getUserBoards(
    @Req() req: UserRequest,
    @Query('pinterestAccountId') pinterestAccountId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ): Promise<
    { pinterestAccountId: string; boards: { id: string; name: string }[] }[]
  > {
    try {
      await this.validateUser(req);
      return await this.pinterestService.fetchUserBoards(
        req.user.userId,
        pinterestAccountId,
        parseInt(page, 10),
        parseInt(limit, 10),
        search,
      );
    } catch (error: unknown) {
      console.error('Error fetching boards:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve Pinterest boards',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('auth/callback')
  async handlePinterestCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: UserRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    try {
      const userId = state;
      await this.pinterestService.exchangeCodeForToken(code, userId);
      console.log(`User ${userId} successfully authenticated with Pinterest.`);
      res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:1234/api'}/dashboard/settings/accounts`,
      );
    } catch (error: unknown) {
      console.error('Pinterest OAuth Callback Error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new HttpException(
        `Pinterest authentication failed: ${errorMessage}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('accounts')
  async getAllPinterestAccounts(@Req() req: UserRequest) {
    return this.pinterestService.getUserPinterestAccounts(req.user.userId);
  }

  @Post('schedule')
  async schedulePin(
    @Req() req: UserRequest,
    @Body()
    body: {
      boardId: string;
      title: string;
      mediaType: 'image' | 'video';
      mediaUrl: string;
      scheduledAt: Date;
      description?: string;
      link?: string;
    },
  ): Promise<{ id: string }> {
    try {
      await this.validateUser(req);
      return await this.pinterestService.schedulePin(
        req.user.id,
        body.boardId,
        body.title,
        body.mediaType,
        body.mediaUrl,
        body.scheduledAt,
        body.description,
        body.link,
      );
    } catch (error: unknown) {
      console.error('Error scheduling Pinterest pin:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to schedule Pinterest pin',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('pin/:id')
  async deletePin(
    @Req() req: UserRequest,
    @Param('id') pinId: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.validateUser(req);
      return await this.pinterestService.deletePin(req.user.id, pinId);
    } catch (error: unknown) {
      console.error('Error deleting Pinterest pin:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to delete Pinterest pin',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('pins')
  async getUserPins(
    @Req() req: UserRequest,
    @Query('pinterestId') pinterestId?: string,
    @Query('boardId') boardId?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('sortBy') sortBy: 'createdAt' | 'title' | 'status' = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<
    {
      id: string;
      title: string;
      createdAt: Date;
      status: string;
      boardId: string;
      description?: string;
      link?: string;
      pinterestAccountId?: string;
    }[]
  > {
    try {
      await this.validateUser(req);
      return await this.pinterestService.fetchUserPins(
        req.user.userId,
        pinterestId,
        boardId,
        status,
        parseInt(page, 10),
        parseInt(limit, 10),
        sortBy,
        sortOrder,
      );
    } catch (error: unknown) {
      console.error('Error fetching user pins:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve Pinterest pins',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('pin/:id')
  async updatePin(
    @Req() req: UserRequest,
    @Param('id') pinId: string,
    @Body() updates: { title?: string; description?: string; link?: string },
  ): Promise<{ success: boolean }> {
    try {
      await this.validateUser(req);
      return await this.pinterestService.updatePin(req.user.id, pinId, updates);
    } catch (error: unknown) {
      console.error('Error updating Pinterest pin:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update Pinterest pin',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('pin')
  async createPin(
    @Req() req: UserRequest,
    @Body()
    body: {
      boardId: string;
      title: string;
      mediaType: 'image' | 'video';
      mediaUrl: string;
      description?: string;
      link?: string;
      richPinType?: 'recipe' | 'article' | 'product';
      price?: number;
      availability?: 'in_stock' | 'out_of_stock' | 'preorder';
    },
  ): Promise<{ id: string }> {
    try {
      await this.validateUser(req);
      return await this.pinterestService.createPin(
        req.user.id,
        body.boardId,
        body.title,
        body.mediaType,
        body.mediaUrl,
        body.description,
        body.link,
        body.richPinType,
        body.price,
        body.availability,
      );
    } catch (error: unknown) {
      console.error('Error creating Pinterest pin:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to create Pinterest pin',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('pin/:id/schedule')
  async updateScheduledPin(
    @Req() req: UserRequest,
    @Param('id') pinId: string,
    @Body() body: { scheduledAt: Date },
  ): Promise<{ success: boolean }> {
    try {
      await this.validateUser(req);
      return await this.pinterestService.updateScheduledPin(
        req.user.id,
        pinId,
        new Date(body.scheduledAt),
      );
    } catch (error: unknown) {
      console.error('Error updating scheduled pin:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update scheduled pin',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('pin/:id/cancel')
  async cancelScheduledPin(
    @Req() req: UserRequest,
    @Param('id') pinId: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.validateUser(req);
      return await this.pinterestService.cancelScheduledPin(req.user.id, pinId);
    } catch (error: unknown) {
      console.error('Error canceling scheduled pin:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to cancel scheduled pin',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('pin/:id')
  async getPinById(
    @Req() req: UserRequest,
    @Param('id') pinId: string,
  ): Promise<any> {
    try {
      await this.validateUser(req);
      return await this.pinterestService.getPinById(req.user.userId, pinId);
    } catch (error: unknown) {
      console.error('Error fetching pin by id:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch pin details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('board/:id')
  async getBoardById(
    @Req() req: UserRequest,
    @Param('id') boardId: string,
    @Query('pinterestAccountId') pinterestAccountId?: string,
  ): Promise<any> {
    try {
      await this.validateUser(req);
      return await this.pinterestService.getBoardById(
        req.user.userId,
        boardId,
        pinterestAccountId,
      );
    } catch (error: unknown) {
      console.error('Error fetching board by id:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch board details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
