import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsSecurePassword } from '../../../common/validators/secure-password.decorator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Rahim@2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  currentPassword: string;

  @ApiProperty({ example: 'NewPass@2026', description: 'Same rules as registration' })
  @IsSecurePassword()
  newPassword: string;
}