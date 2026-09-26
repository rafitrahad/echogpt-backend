import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '../../../common/enums';
import { User } from '../entities/user.entity';

/** The safe, public shape of a user. Never includes passwordHash. */
export class UserResponseDto {
  @ApiProperty({ example: '7c46ad9d-bbb3-4258-8635-c400d63eac21' })
  id: string;

  @ApiProperty({ example: 'rahim@gmail.com' })
  email: string;

  @ApiProperty({ example: 'Rahim Uddin', nullable: true, type: String })
  fullName: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  avatarUrl: string | null;

  @ApiProperty({ enum: RoleName, example: RoleName.USER })
  role: RoleName;

  @ApiProperty({ example: false })
  isEmailVerified: boolean;

  @ApiProperty({ example: '2026-09-26T14:30:00.000Z' })
  createdAt: Date;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.fullName = user.fullName;
    dto.avatarUrl = user.avatarUrl;
    dto.role = user.role.name as RoleName;
    dto.isEmailVerified = user.isEmailVerified;
    dto.createdAt = user.createdAt;
    return dto;
  }
}