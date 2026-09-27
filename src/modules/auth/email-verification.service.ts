import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { generateSecureToken, sha256 } from '../../common/utils/hash.util';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';

const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly appUrl: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    config: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(EmailVerificationToken)
    private readonly tokensRepo: Repository<EmailVerificationToken>,
  ) {
    this.appUrl = config.getOrThrow<string>('APP_URL').replace(/\/+$/, '');
  }

  /**
   * Creates a one-time token and emails the link.
   * Only a SHA-256 hash of the token is stored; the raw token exists only in the email.
   * Never throws: a failed email must not break registration.
   */
  async sendVerificationEmail(user: Pick<User, 'id' | 'email' | 'fullName'>): Promise<void> {
    try {
      // Only the newest link should work: remove older unused tokens
      await this.tokensRepo.delete({ userId: user.id, usedAt: IsNull() });

      const token = generateSecureToken(32);
      await this.tokensRepo.save(
        this.tokensRepo.create({
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS),
        }),
      );

      const link = `${this.appUrl}/api/v1/auth/verify-email?token=${token}`;
      const name = user.fullName ?? 'there';
      await this.mailService.send({
        to: user.email,
        subject: 'Verify your EchoGPT email',
        text: `Hi ${name},\n\nPlease verify your email by opening this link (valid for 24 hours):\n${link}\n\nIf you did not create an EchoGPT account, ignore this email.`,
        html: `<p>Hi ${this.escapeHtml(name)},</p><p>Please verify your email (link valid for 24 hours):</p><p><a href="${link}">Verify my email</a></p><p>If you did not create an EchoGPT account, ignore this email.</p>`,
      });
    } catch (error) {
      this.logger.error(
        `Could not send verification email to user ${user.id}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /** Marks the email as verified. The token works once, and only for 24 hours. */
  async verify(token: string): Promise<void> {
    const record = await this.tokensRepo.findOneBy({ tokenHash: sha256(token) });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This verification link is invalid or has expired');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(EmailVerificationToken, { id: record.id }, { usedAt: new Date() });
      await manager.update(User, { id: record.userId }, { isEmailVerified: true });
    });
  }

  async resend(userId: string): Promise<void> {
    const user = await this.usersRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    if (user.isEmailVerified) throw new ConflictException('Your email is already verified');
    await this.sendVerificationEmail(user);
  }

  private escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }
}