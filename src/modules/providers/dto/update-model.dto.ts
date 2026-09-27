import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateModelDto } from './create-model.dto';

/** Everything optional; modelKey cannot change (delete and re-add instead) */
export class UpdateModelDto extends PartialType(OmitType(CreateModelDto, ['modelKey'] as const)) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}