import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsSecurePassword } from '../../../common/validators/secure-password.decorator';

export class RegisterDto {
  @ApiProperty({ example: 'rahim@gmail.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: 'Rahim@2026',
    description: '8-72 characters, with at least one uppercase letter, one lowercase letter and one number',
  })
  @IsSecurePassword()
  password: string;

  @ApiPropertyOptional({ example: 'Rahim Uddin' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;
}