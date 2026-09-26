import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ example: 'Rahim@2026', description: 'Current password, to confirm it is really you' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}