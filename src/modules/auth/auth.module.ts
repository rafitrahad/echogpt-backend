import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Session } from './entities/session.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerificationToken } from './entities/email-verification-token.entity';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}), // secrets are passed per call (access vs refresh)
    TypeOrmModule.forFeature([User, Session, EmailVerificationToken]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, EmailVerificationService],
  exports: [AuthService],
})
export class AuthModule {}