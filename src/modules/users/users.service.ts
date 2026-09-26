import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { RoleName } from '../../common/enums';
import { AuthService } from '../auth/auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  async getProfile(userId: string): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(await this.findByIdOrFail(userId));
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserResponseDto> {
    const user = await this.findByIdOrFail(userId);

    if (dto.fullName !== undefined) user.fullName = dto.fullName.trim();
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;

    await this.usersRepo.save(user);
    return UserResponseDto.fromEntity(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.findWithPasswordOrFail(userId);
    await this.assertPasswordMatches(dto.currentPassword, user.passwordHash);

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersRepo.update(userId, { passwordHash });

    // Log out everywhere: if someone else knew the old password, their sessions die now
    await this.authService.revokeAllSessions(userId);
  }

  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.findWithPasswordOrFail(userId);
    await this.assertPasswordMatches(password, user.passwordHash);

    // Never allow the system to lose its last admin
    if (user.role.name === RoleName.ADMIN) {
      const adminCount = await this.usersRepo.count({
        where: { role: { name: RoleName.ADMIN } },
      });
      if (adminCount <= 1) {
        throw new ConflictException('The last admin account cannot be deleted');
      }
    }

    // CASCADE removes sessions, subscriptions, conversations, messages and searches.
    // SET NULL keeps request logs, but anonymous.
    await this.usersRepo.delete(userId);
  }

  // ─────────────────────────── Helpers ───────────────────────────

  private async findByIdOrFail(userId: string): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { role: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async findWithPasswordOrFail(userId: string): Promise<User> {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.id = :userId', { userId })
      .getOne();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async assertPasswordMatches(password: string, hash: string): Promise<void> {
    const valid = await bcrypt.compare(password, hash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
  }
}