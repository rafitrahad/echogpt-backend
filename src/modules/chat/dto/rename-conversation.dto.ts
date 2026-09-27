import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RenameConversationDto {
  @ApiProperty({ example: 'Thesis outline on GDP' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;
}