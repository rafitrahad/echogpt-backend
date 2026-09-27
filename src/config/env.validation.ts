import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Every setting the app needs, with its rules.
 * The app refuses to start if any rule fails.
 */
class EnvironmentVariables {
  // ── App ──
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsString()
  @IsNotEmpty()
  APP_TIMEZONE: string;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN: string;

  // ── Database ──
  @Matches(/^postgres(ql)?:\/\/.+/, {
    message: 'DATABASE_URL must start with postgresql://',
  })
  DATABASE_URL: string;

  // Kept as a string on purpose: see explanation
  @IsOptional()
  @IsIn(['true', 'false'])
  DB_LOGGING?: string;

  // ── JWT ──
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN: string;

  // ── Encryption: exactly 32 bytes = 64 hex characters ──
  @Matches(/^[0-9a-f]{64}$/i, {
    message: 'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)',
  })
  ENCRYPTION_KEY: string;

  // ── Seed only: optional for the running app ──
  @IsOptional()
  @IsEmail()
  ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  ADMIN_PASSWORD?: string;

  // ── Rate limiting ──
  @IsInt()
  @Min(1)
  THROTTLE_TTL_SECONDS: number;

  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number;

  // ── Search ──
  @IsInt()
  @Min(0)
  SEARCH_CACHE_TTL_SECONDS: number;

  // ── AI: true = fake answers, no API keys needed ──
  @IsOptional()
  @IsIn(['true', 'false'])
  AI_MOCK_MODE?: string;

    // ── Web search engine: wikipedia (free), tavily (needs key) or mock ──
  @IsOptional()
  @IsIn(['wikipedia', 'tavily', 'mock'])
  SEARCH_PROVIDER?: string;

  @IsOptional()
  @IsString()
  TAVILY_API_KEY?: string;

}
  
/**
 * Called by NestJS's ConfigModule at startup with everything from .env.
 * Returns the validated (and type-converted) config, or throws.
 */
export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  // Extra rule decorators can't express: the two JWT secrets must differ
  if (validated.JWT_ACCESS_SECRET && validated.JWT_ACCESS_SECRET === validated.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }

  if (errors.length > 0) {
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new Error(`Invalid environment variables:\n- ${messages.join('\n- ')}`);
  }

  return validated;
}