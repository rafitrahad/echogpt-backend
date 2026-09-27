import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetEnabledDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isEnabled: boolean;
}