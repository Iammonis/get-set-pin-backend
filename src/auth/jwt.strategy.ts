/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  // ✅ Ensure 'jwt' is the strategy name
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => {
          const token = req?.cookies?.['get-set-pin-token'];
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'), // ✅ Ensure JWT_SECRET is set
    });
  }

  validate(payload: { userId: string; email: string }): {
    userId: string;
    email: string;
  } {
    console.log('Validating JWT payload:', payload);
    return { userId: payload.userId, email: payload.email };
  }
}
