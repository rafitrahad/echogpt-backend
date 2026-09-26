import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { RoleName, SubscriptionStatus } from '../../common/enums';
import { JwtAccessPayload } from '../../common/interfaces/authenticated-user.interface';
import { safeEqual, sha256 } from '../../common/utils/hash.util';
import { RequestMeta } from '../../common/utils/request-meta.util';
import { Plan } from '../subscriptions/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { AuthResponseDto, AuthTokensDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Session } from './entities/session.entity';

/** What we put inside a refresh token */
interface RefreshPayload {
  sub: string; // user id
  sid: string; // session id
  jti: string; // unique token id, so every refresh token is different
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Used when the email doesn't exist, so login takes the same time either way
  private readonly dummyHash = bcrypt.hashSync('timing-attack-protection', BCRYPT_ROUNDS);

  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Session) private readonly sessionsRepo: Repository<Session>,
  ) {}

  // ─────────────────────────── Register ───────────────────────────

  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResponseDto> {
    const emailTaken = await this.usersRepo.existsBy({ email: dto.email });
    if (emailTaken) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // User + FREE subscription are created together, or not at all
    const userId = await this.dataSource.transaction(async (manager) => {
      const userRole = await manager.findOneBy(Role, { name: RoleName.USER });
      const freePlan = await manager.findOneBy(Plan, { code: 'FREE' });
      if (!userRole || !freePlan) {
        throw new InternalServerErrorException('Default role or plan is missing. Run the seed script.');
      }

      const user = await manager.save(
        manager.create(User, {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName ?? null,
          roleId: userRole.id,
        }),
      );

      await manager.save(
        manager.create(Subscription, {
          userId: user.id,
          planId: freePlan.id,
          status: SubscriptionStatus.ACTIVE,
        }),
      );

      return user.id;
    });

    const user = await this.usersRepo.findOneOrFail({
      where: { id: userId },
      relations: { role: true },
    });
    const tokens = await this.createSession(user, meta);
    return { user: UserResponseDto.fromEntity(user), tokens };
  }

  // ─────────────────────────── Login ───────────────────────────

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResponseDto> {
    // passwordHash is select:false, so we must ask for it explicitly
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.email = :email', { email: dto.email })
      .getOne();

    // Always run bcrypt, even for unknown emails: same response time, same message
    const passwordValid = await bcrypt.compare(dto.password, user?.passwordHash ?? this.dummyHash);
    if (!user || !passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account has been suspended');
    }

    await this.usersRepo.update(user.id, { lastLoginAt: new Date() });

    const tokens = await this.createSession(user, meta);
    return { user: UserResponseDto.fromEntity(user), tokens };
  }

  // ─────────────────────────── Refresh (rotation) ───────────────────────────

  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const session = await this.sessionsRepo.findOne({
      where: { id: payload.sid, userId: payload.sub },
      relations: { user: { role: true } },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is no longer valid. Please log in again.');
    }

    // A valid signature but a hash that doesn't match = an OLD token was reused.
    // That token was probably stolen, so revoke every session of this user.
    if (!safeEqual(session.refreshTokenHash, sha256(refreshToken))) {
      await this.revokeAllSessions(session.userId);
      this.logger.warn(`Refresh token reuse detected for user ${session.userId}. All sessions revoked.`);
      throw new UnauthorizedException('Refresh token reuse detected. Please log in again.');
    }

    if (!session.user.isActive) {
      throw new ForbiddenException('This account has been suspended');
    }

    return this.rotateSession(session, session.user);
  }

  // ─────────────────────────── Logout ───────────────────────────

  /** Revokes one session (this device). Always succeeds, so it reveals nothing. */
  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      await this.sessionsRepo.update(
        { id: payload.sid, userId: payload.sub, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    } catch {
      // Invalid or expired token: nothing to revoke
    }
  }

  /** Revokes every session of the user (all devices) */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.sessionsRepo.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  // ─────────────────────────── Helpers ───────────────────────────

  /** New device login: create a session row, then fill it with fresh tokens */
  private async createSession(user: User, meta: RequestMeta): Promise<AuthTokensDto> {
    const session = await this.sessionsRepo.save(
      this.sessionsRepo.create({
        userId: user.id,
        refreshTokenHash: sha256(randomUUID()), // placeholder, replaced right below
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(),
      }),
    );
    return this.rotateSession(session, user);
  }

  /** Issues a new access + refresh token pair and stores the new refresh hash */
  private async rotateSession(session: Session, user: User): Promise<AuthTokensDto> {
    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role.name as RoleName,
    };
    const refreshPayload: RefreshPayload = { sub: user.id, sid: session.id, jti: randomUUID() };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN') as JwtSignOptions['expiresIn'],
    });
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN') as JwtSignOptions['expiresIn'],
    });

    // Read the real expiry times from the tokens themselves
    const access = this.jwtService.decode<{ iat: number; exp: number }>(accessToken);
    const refresh = this.jwtService.decode<{ exp: number }>(refreshToken);

    session.refreshTokenHash = sha256(refreshToken);
    session.expiresAt = new Date(refresh.exp * 1000);
    await this.sessionsRepo.save(session);

    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: access.exp - access.iat };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshPayload> {
    try {
      return await this.jwtService.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}