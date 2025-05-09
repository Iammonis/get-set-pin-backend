import { Controller, Post, Body, Put, Param, Patch } from '@nestjs/common';
import { UsersService } from '@/src/users/users.service';
// import { User } from '@/src/types/global.types';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string }) {
    return this.usersService.createUser(body.email, body.password);
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.usersService.loginUser(body.email, body.password);
  }

  @Put('update-profile/:userId')
  async updateProfile(
    @Param('userId') userId: string,
    @Body() body: { email?: string; password?: string },
  ) {
    return this.usersService.updateUserProfile(
      userId,
      body.email,
      body.password,
    );
  }

  @Post('request-password-reset')
  async requestPasswordReset(@Body() body: { email: string }) {
    return this.usersService.requestPasswordReset(body.email);
  }

  @Patch('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.usersService.resetPassword(body.token, body.newPassword);
  }

  @Patch('deactivate/:userId')
  async deactivateUser(@Param('userId') userId: string) {
    return this.usersService.deactivateUser(userId);
  }
}
