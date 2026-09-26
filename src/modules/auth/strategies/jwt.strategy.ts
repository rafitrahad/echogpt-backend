import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { RoleName } from '../../../common/enums';
import {
  AuthenticatedUser,
  JwtAccessPayload,
} from '../../../common/interfaces/authenticated-user.interface';
import { User } from '../../users/entities/user.entity';

/**
 * Verifies the access token on every protected request,
 * then loads the user to make sure they still exist and are active.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /** Called only if the signature and expiry are valid. The return value becomes request.user */
  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    const user = await this.usersRepo.findOne({
      where: { id: payload.sub },
      relations: { role: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or suspended');
    }

    return { id: user.id, email: user.email, role: user.role.name as RoleName };
  }
}