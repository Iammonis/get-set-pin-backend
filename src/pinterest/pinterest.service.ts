import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import qs from 'qs';
import { PrismaService } from '@/src/prisma/prisma.service';
import { PinterestTokenResponse } from '@/src/types/global.types';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PinStatus } from '@prisma/client';

@Injectable()
export class PinterestService {
  constructor(
    private readonly configService: ConfigService<Record<string, string>>,
    private readonly prisma: PrismaService,
    @InjectQueue('pinQueue') private pinQueue: Queue,
  ) {}

  getPinterestAuthUrl(userId: string): string {
    const clientId = this.configService.get<string>('PINTEREST_CLIENT_ID');
    const redirectUri = this.configService.get<string>(
      'PINTEREST_REDIRECT_URI',
    );
    const scopes =
      'pins:read,pins:write,boards:read,boards:write,user_accounts:read';

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri || '',
      response_type: 'code',
      scope: scopes,
      state: userId,
    });

    return `https://www.pinterest.com/oauth/?${params.toString()}`;
  }

  async checkUserPinterestAccount(userId: string): Promise<void> {
    console.log(`Checking Pinterest account for userId: ${userId}`);
    const pinterestAccount = await this.prisma.pinterestAccount.findFirst({
      where: { userId },
    });

    if (!pinterestAccount) {
      throw new HttpException(
        'No Pinterest account connected. Please connect an account first.',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async fetchUserBoards(
    userId: string | undefined,
    pinterestAccountId?: string,
    page = 1,
    limit = 10,
    search?: string,
    sortBy: 'name' | 'createdAt' | 'pinCount' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<
    {
      pinterestAccountId: string;
      boards: { id: string; name: string; createdAt: Date; pinCount: number }[];
    }[]
  > {
    if (!userId) {
      throw new HttpException(
        'User ID is missing. Ensure you are authenticated and sending the token.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const where = pinterestAccountId
      ? { userId, pinterestId: pinterestAccountId }
      : { userId };

    const pinterestAccounts = await this.prisma.pinterestAccount.findMany({
      where,
    });

    if (!pinterestAccounts.length) {
      throw new HttpException(
        'No Pinterest account(s) connected.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const results: Array<{
      pinterestAccountId: string;
      boards: { id: string; name: string; createdAt: Date; pinCount: number }[];
      error?: string;
    }> = [];

    for (const account of pinterestAccounts) {
      try {
        const url = new URL('https://api.pinterest.com/v5/boards');
        url.searchParams.set('page_size', limit.toString());
        url.searchParams.set('page', page.toString());
        if (search) url.searchParams.set('query', search);

        const response = await axios.get<{
          items: { id: string; name: string; created_at: string }[];
        }>(url.toString(), {
          headers: { Authorization: `Bearer ${account.accessToken}` },
        });

        // Get pin counts for all boards in this account
        const boardIds = response.data.items.map((b) => b.id);
        const pinCounts = await this.prisma.pin.groupBy({
          by: ['boardId'],
          where: {
            boardId: { in: boardIds },
            userId,
            deletedAt: null,
          },
          _count: { id: true },
        });

        const pinCountMap = Object.fromEntries(
          pinCounts.map((pc) => [pc.boardId, pc._count.id]),
        );

        let boards = response.data.items.map((b) => ({
          id: b.id,
          name: b.name,
          createdAt: new Date(b.created_at),
          pinCount: pinCountMap[b.id] || 0,
        }));

        // Sorting
        boards = boards.sort((a, b) => {
          let cmp = 0;
          if (sortBy === 'name') {
            cmp = a.name.localeCompare(b.name);
          } else if (sortBy === 'createdAt') {
            cmp = a.createdAt.getTime() - b.createdAt.getTime();
          } else if (sortBy === 'pinCount') {
            cmp = a.pinCount - b.pinCount;
          }
          return sortOrder === 'desc' ? -cmp : cmp;
        });

        results.push({
          pinterestAccountId: account.pinterestId,
          boards,
        });
      } catch (error: unknown) {
        console.error(
          `Error fetching boards for Pinterest account ${account.pinterestId}:`,
          error instanceof Error ? error.message : JSON.stringify(error),
        );
        results.push({
          pinterestAccountId: account.pinterestId,
          boards: [],
          error: 'Failed to fetch boards',
        });
      }
    }

    return results;
  }

  async createPin(
    userId: string,
    boardId: string,
    title: string,
    mediaType: 'image' | 'video',
    mediaUrl: string,
    description?: string,
    link?: string,
    richPinType?: 'recipe' | 'article' | 'product',
    price?: number,
    availability?: 'in_stock' | 'out_of_stock' | 'preorder',
  ): Promise<{ id: string }> {
    console.log(
      `createPin called with userId: ${userId}, boardId: ${boardId}, title: ${title}`,
    );
    await this.checkUserPinterestAccount(userId); // New validation method

    const pinterestAccount = await this.prisma.pinterestAccount.findFirst({
      where: { userId },
    });

    const media_source =
      mediaType === 'image'
        ? { source_type: 'image_url', url: mediaUrl }
        : { source_type: 'video_url', cover_image_url: mediaUrl };

    const pinData: Record<string, any> = {
      board_id: boardId,
      title,
      description,
      link,
      media_source,
    };

    if (richPinType) {
      pinData['rich_metadata'] = { type: richPinType, price, availability };
    }

    try {
      const response = await axios.post<{ id: string }>(
        'https://api.pinterest.com/v5/pins',
        pinData,
        {
          headers: { Authorization: `Bearer ${pinterestAccount?.accessToken}` },
        },
      );

      console.log('Pinterest createPin response:', response.data);

      if (!response.data || !response.data.id) {
        throw new Error('Invalid response received from Pinterest API.');
      }

      return { id: response.data.id }; // ✅ Explicitly returning structured response
    } catch (error: unknown) {
      console.error(
        'Error creating Pinterest pin:',
        error instanceof Error ? error.message : JSON.stringify(error),
      );

      const errorMessage: string | Record<string, any> =
        axios.isAxiosError(error) && error.response?.data
          ? (error.response.data as string | Record<string, any>)
          : 'Failed to create pin';

      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }

  async exchangeCodeForToken(code: string, userId: string) {
    console.log(
      `exchangeCodeForToken called with code: ${code}, userId: ${userId}`,
    );
    const clientId = this.configService.get<string>('PINTEREST_CLIENT_ID', '');
    const clientSecret = this.configService.get<string>(
      'PINTEREST_CLIENT_SECRET',
      '',
    );
    const redirectUri = this.configService.get<string>(
      'PINTEREST_REDIRECT_URI',
      '',
    );

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Pinterest OAuth configuration is missing.');
    }

    try {
      const credentials = `${clientId}:${clientSecret}`;
      const base64Credentials = Buffer.from(credentials, 'utf-8').toString(
        'base64',
      );

      const data = qs.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        continuous_refresh: true,
      });

      console.log('Data to be sent:', data);

      const tokenResponse = await axios.post<PinterestTokenResponse>(
        'https://api.pinterest.com/v5/oauth/token',
        data,
        {
          headers: {
            Authorization: `Basic ${base64Credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
        },
      );

      console.log('Token response received:', tokenResponse.data);

      if (!tokenResponse.data.access_token) {
        throw new Error('Failed to obtain access token from Pinterest.');
      }

      const { access_token, refresh_token } = tokenResponse.data;

      const userResponse = await axios.get<{ id: string }>(
        'https://api.pinterest.com/v5/user_account',
        {
          headers: { Authorization: `Bearer ${access_token}` },
        },
      );

      console.log('Pinterest user info:', userResponse.data);

      const pinterestId: string = userResponse.data.id;

      console.log('Upserting Pinterest account in DB...');
      await this.prisma.pinterestAccount.upsert({
        where: { pinterestId },
        update: { accessToken: access_token, refreshToken: refresh_token },
        create: {
          userId,
          pinterestId,
          accessToken: access_token,
          refreshToken: refresh_token,
        },
      });
      console.log('Upsert complete.');

      return { access_token, refresh_token };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(
          'Error exchanging code for token:',
          error.response?.data || error.message,
        );
        throw new Error('Failed to retrieve access token from Pinterest.');
      } else if (error instanceof Error) {
        console.error('Error:', error.message);
        throw new Error(
          'Unexpected error occurred while retrieving access token.',
        );
      } else {
        console.error(
          'Unknown error:',
          error instanceof Error ? error.message : JSON.stringify(error),
        );
        throw new Error(
          'Unexpected error occurred while retrieving access token.',
        );
      }
    }
  }

  async refreshAccessToken(userId: string, pinterestId: string): Promise<void> {
    console.log(
      `refreshAccessToken called with userId: ${userId}, pinterestId: ${pinterestId}`,
    );
    const pinterestAccount = await this.prisma.pinterestAccount.findUnique({
      where: { pinterestId },
    });

    if (!pinterestAccount || !pinterestAccount.refreshToken) {
      throw new Error('Pinterest account or refresh token not found.');
    }

    const clientId = this.configService.get<string>('PINTEREST_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'PINTEREST_CLIENT_SECRET',
    );

    try {
      const credentials = `${clientId}:${clientSecret}`;
      const base64Credentials = Buffer.from(credentials, 'utf-8').toString(
        'base64',
      );

      const data = qs.stringify({
        grant_type: 'refresh_token',
        refresh_token: pinterestAccount.refreshToken,
      });

      const tokenResponse = await axios.post<{
        access_token: string;
        refresh_token?: string;
      }>('https://api.pinterest.com/v5/oauth/token', data, {
        headers: {
          Authorization: `Basic ${base64Credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });

      console.log('Token refresh response:', tokenResponse.data);

      if (!tokenResponse.data.access_token) {
        throw new Error('Failed to refresh access token.');
      }

      await this.prisma.pinterestAccount.update({
        where: { pinterestId },
        data: {
          accessToken: tokenResponse.data.access_token,
          refreshToken:
            tokenResponse.data.refresh_token || pinterestAccount.refreshToken,
        },
      });
      console.log('Pinterest account tokens updated in DB.');
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(
          'Error refreshing access token:',
          error.response?.data || error.message,
        );
        throw new Error('Failed to refresh Pinterest access token.');
      } else if (error instanceof Error) {
        console.error('Error:', error.message);
        throw new Error('Unexpected error occurred while refreshing token.');
      } else {
        console.error(
          'Unknown error:',
          error instanceof Error ? error.message : JSON.stringify(error),
        );
        throw new Error('Unexpected error occurred while refreshing token.');
      }
    }
  }

  // 📌 Implement Pin Scheduling
  async schedulePin(
    userId: string,
    boardId: string,
    title: string,
    mediaType: 'image' | 'video',
    mediaUrl: string,
    scheduledAt: Date,
    description?: string,
    link?: string,
  ): Promise<{ id: string }> {
    console.log(
      `schedulePin called with userId: ${userId}, boardId: ${boardId}, title: ${title}, scheduledAt: ${scheduledAt.toString()}`,
    );
    await this.checkUserPinterestAccount(userId); // New validation method

    const pinterestAccount = await this.prisma.pinterestAccount.findFirst({
      where: { userId },
    });

    const pinterestAccountId = pinterestAccount?.id;
    if (!pinterestAccountId) {
      throw new HttpException(
        'Pinterest account ID is missing.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Store scheduled pin in DB
    const pin = await this.prisma.pin.create({
      data: {
        userId,
        pinterestAccountId,
        boardId,
        title,
        mediaType,
        imageUrl: mediaType === 'image' ? mediaUrl : null,
        videoUrl: mediaType === 'video' ? mediaUrl : null,
        scheduledAt,
        status: 'scheduled',
        description,
        link,
        createdBy: userId, // ✅ Add required createdBy field
        updatedBy: userId, // ✅ Add required updatedBy field
      },
    });

    console.log('Scheduled pin created in DB:', pin.id);

    // Add job to queue
    await this.pinQueue.add(
      'postPin',
      { pinId: pin.id },
      { delay: scheduledAt.getTime() - Date.now() },
    );

    console.log(
      'Pin job added to queue with delay:',
      scheduledAt.getTime() - Date.now(),
    );

    return { id: pin.id };
  }

  // 📌 Implement Pin Deletion
  async deletePin(
    userId: string,
    pinId: string,
  ): Promise<{ success: boolean }> {
    console.log(`deletePin called with userId: ${userId}, pinId: ${pinId}`);
    const pin = await this.prisma.pin.findFirst({
      where: { id: pinId, userId },
    });

    if (!pin) {
      throw new HttpException('Pin not found', HttpStatus.NOT_FOUND);
    }

    // Soft delete by setting deletedAt timestamp
    await this.prisma.pin.update({
      where: { id: pinId },
      data: { deletedAt: new Date() },
    });

    console.log(`Pin ${pinId} soft deleted.`);

    return { success: true };
  }

  // 📌 Fetch User Pins
  async fetchUserPins(
    userId: string,
    pinterestId?: string,
    boardId?: string,
    status?: string,
    page = 1,
    limit = 10,
    sortBy: 'createdAt' | 'title' | 'status' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
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
    const where: {
      userId: string;
      deletedAt: null;
      pinterestAccountId?: string;
      boardId?: string;
      status?: PinStatus;
    } = { userId, deletedAt: null };

    if (pinterestId) {
      const pinterestAccount = await this.prisma.pinterestAccount.findFirst({
        where: { userId, pinterestId },
        select: { id: true },
      });
      if (!pinterestAccount) {
        throw new HttpException(
          'Pinterest account not found',
          HttpStatus.NOT_FOUND,
        );
      }
      where.pinterestAccountId = pinterestAccount.id;
    }
    if (boardId) {
      where.boardId = boardId;
    }
    if (status) {
      // Ensure status is a valid PinStatus enum value
      if (Object.values(PinStatus).includes(status as PinStatus)) {
        where.status = status as PinStatus;
      } else {
        throw new HttpException(
          `Invalid pin status: ${status}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const pins = await this.prisma.pin.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        createdAt: true,
        status: true,
        boardId: true,
        description: true,
        link: true,
        pinterestAccountId: true,
      },
    });

    return pins.map((pin) => ({
      ...pin,
      description: pin.description ?? undefined,
      link: pin.link ?? undefined,
    }));
  }

  // 📌 Update Pin Status & Metadata
  async updatePin(
    userId: string,
    pinId: string,
    updates: { title?: string; description?: string; link?: string },
  ): Promise<{ success: boolean }> {
    console.log(
      `updatePin called with userId: ${userId}, pinId: ${pinId}, updates: ${JSON.stringify(updates)}`,
    );
    const pin = await this.prisma.pin.findFirst({
      where: { id: pinId, userId, deletedAt: null },
    });

    if (!pin) {
      throw new HttpException('Pin not found', HttpStatus.NOT_FOUND);
    }

    await this.prisma.pin.update({
      where: { id: pinId },
      data: { ...updates, updatedAt: new Date() },
    });

    console.log(`Pin ${pinId} updated.`);

    return { success: true };
  }

  async updateScheduledPin(
    userId: string,
    pinId: string,
    newScheduledAt: Date,
  ): Promise<{ success: boolean }> {
    const pin = await this.prisma.pin.findFirst({
      where: { id: pinId, userId, status: 'scheduled' },
    });

    if (!pin) {
      throw new HttpException('Scheduled pin not found', HttpStatus.NOT_FOUND);
    }

    // Remove the old job from the queue (BullMQ)
    const job = (await this.pinQueue.getJob(pinId)) as
      | import('bullmq').Job
      | null;
    if (job) {
      await job.remove();
    }

    // Update the scheduled time in the database
    await this.prisma.pin.update({
      where: { id: pinId },
      data: { scheduledAt: newScheduledAt, updatedAt: new Date() },
    });

    // Re-add the job with the new scheduled time
    await this.pinQueue.add(
      'postPin',
      { pinId },
      { delay: newScheduledAt.getTime() - Date.now(), jobId: pinId },
    );

    return { success: true };
  }

  async cancelScheduledPin(
    userId: string,
    pinId: string,
  ): Promise<{ success: boolean }> {
    const pin = await this.prisma.pin.findFirst({
      where: { id: pinId, userId, status: 'scheduled' },
    });

    if (!pin) {
      throw new HttpException('Scheduled pin not found', HttpStatus.NOT_FOUND);
    }

    // Remove the job from the queue (BullMQ)
    const job = (await this.pinQueue.getJob(pinId)) as
      | import('bullmq').Job
      | null;
    if (job) {
      await job.remove();
    }

    // Mark the pin as canceled
    await this.prisma.pin.update({
      where: { id: pinId },
      data: { status: 'cancelled', updatedAt: new Date() },
    });

    return { success: true };
  }

  async getUserPinterestAccounts(userId: string): Promise<
    {
      pinterestId: string;
      username: string;
      accountType: string;
      profileImage: string;
    }[]
  > {
    console.log(`Fetching all linked Pinterest accounts for userId: ${userId}`);
    const accounts = await this.prisma.pinterestAccount.findMany({
      where: { userId },
    });

    const results: Awaited<ReturnType<typeof this.getUserPinterestAccounts>> =
      [];

    for (const account of accounts) {
      try {
        const profileResponse = await axios.get<{
          username: string;
          account_type: string;
          profile_image: string;
        }>('https://api.pinterest.com/v5/user_account', {
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
          },
        });

        results.push({
          pinterestId: account.pinterestId,
          username: profileResponse.data.username,
          accountType: profileResponse.data.account_type,
          profileImage: profileResponse.data.profile_image,
        });
      } catch (error) {
        console.error(
          `Error fetching profile for Pinterest ID ${account.pinterestId}:`,
          axios.isAxiosError(error)
            ? error.response?.data || error.message
            : error,
        );
      }
    }

    return results;
  }

  // Get details for a single pin
  async getPinById(userId: string, pinId: string): Promise<any> {
    const pin = await this.prisma.pin.findFirst({
      where: { id: pinId, userId, deletedAt: null },
      select: {
        id: true,
        title: true,
        createdAt: true,
        status: true,
        boardId: true,
        description: true,
        link: true,
        pinterestAccountId: true,
        scheduledAt: true,
        mediaType: true,
        imageUrl: true,
        videoUrl: true,
      },
    });

    if (!pin) {
      throw new HttpException('Pin not found', HttpStatus.NOT_FOUND);
    }

    return pin;
  }

  // Get details for a single board
  async getBoardById(
    userId: string,
    boardId: string,
    pinterestAccountId?: string,
  ): Promise<any> {
    // Try local DB first
    const pinBoard = await this.prisma.board.findFirst({
      where: { id: boardId, userId },
    });

    if (pinBoard) {
      return pinBoard;
    }

    // Fetch from Pinterest API using the correct account
    const pinterestAccount = await this.prisma.pinterestAccount.findFirst({
      where: pinterestAccountId
        ? { userId, id: pinterestAccountId }
        : { userId },
    });

    if (!pinterestAccount) {
      throw new HttpException(
        'Pinterest account not found',
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      const response = await axios.get<any>(
        `https://api.pinterest.com/v5/boards/${boardId}`,
        {
          headers: { Authorization: `Bearer ${pinterestAccount.accessToken}` },
        },
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching board from Pinterest:', error);
      throw new HttpException(
        'Failed to fetch board details from Pinterest',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
