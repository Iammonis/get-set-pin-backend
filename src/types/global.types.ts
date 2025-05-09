// src/types/global.types.ts

import { Request } from 'express';

export interface UserRequest extends Request {
  user: {
    userId: any;
    id: string;
    // add any other properties of user here if needed
  };
}

/** General Response Type */
export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
};

/** User Type */
export type User = {
  id: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date; // ✅ Ensure this exists
  deactivatedAt?: Date | null; // ✅ Ensure this exists
};

/** Pinterest Account Type */
export type PinterestAccount = {
  id: string;
  userId: string;
  pinterestId: string;
  accessToken: string;
  refreshToken?: string;
  createdAt: Date;
};

/** Pin Type */
export type Pin = {
  id: string;
  userId: string;
  pinterestAccountId: string;
  boardId: string;
  title: string;
  imageUrl: string;
  scheduledAt: Date;
  status: 'scheduled' | 'posted' | 'failed';
  createdAt: Date;
};

/** Pinterest OAuth Token Response */
export type PinterestTokenResponse = {
  access_token: string;
  refresh_token: string;
};
