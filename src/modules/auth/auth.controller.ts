import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { getRequestMeta } from '../../common/utils/request-meta.util';
import { AuthService } from './auth.service';
import { AuthResponseDto, AuthTokensDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { MessageResponseDto, VerifyEmailDto } from './dto/verify-email.dto';
import { EmailVerificationService } from './email-verification.service';

// Stricter limit for sensitive routes: 5 requests per minute
const STRICT_LIMIT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Auth')
@ApiTooManyRequestsResponse({ description: 'Too many requests, slow down' })
@Controller('auth')
export class AuthController {
    constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('register')
  @ApiOperation({ summary: 'Create an account (starts on the FREE plan) and log in' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed (e.g. weak password)' })
  @ApiConflictResponse({ description: 'Email already registered' })
  register(@Body() dto: RegisterDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.authService.register(dto, getRequestMeta(req));
  }

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiForbiddenResponse({ description: 'Account suspended' })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.authService.login(dto, getRequestMeta(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a new token pair. The old refresh token stops working (rotation).' })
  @ApiOkResponse({ type: AuthTokensDto })
  @ApiUnauthorizedResponse({ description: 'Invalid, expired, revoked or reused refresh token' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Log out this device (revokes its refresh token)' })
  @ApiNoContentResponse({ description: 'Logged out' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @ApiBearerAuth('access-token')
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Log out from all devices' })
  @ApiNoContentResponse({ description: 'All sessions revoked' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async logoutAll(@CurrentUser('id') userId: string): Promise<void> {
    await this.authService.revokeAllSessions(userId);
  }

    // ─────────── Email verification (bonus) ───────────

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email by opening the link from the email (token in the URL)' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ description: 'Link invalid, expired or already used' })
  async verifyEmailLink(@Query() dto: VerifyEmailDto): Promise<MessageResponseDto> {
    await this.emailVerification.verify(dto.token);
    return { message: 'Email verified successfully. You can close this page.' };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with the token (for apps, e.g. the extension)' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ description: 'Token invalid, expired or already used' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResponseDto> {
    await this.emailVerification.verify(dto.token);
    return { message: 'Email verified successfully' };
  }

  @ApiBearerAuth('access-token')
  @Throttle(STRICT_LIMIT)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a new verification email (older links stop working)' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiConflictResponse({ description: 'Email already verified' })
  async resendVerification(@CurrentUser('id') userId: string): Promise<MessageResponseDto> {
    await this.emailVerification.resend(userId);
    return { message: 'Verification email sent' };
  }
}