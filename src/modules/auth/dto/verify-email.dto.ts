import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'k8Jd92LmQx7vB3nZ...', description: 'The token from the verification email link' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token: string;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Email verified successfully' })
  message: string;
}