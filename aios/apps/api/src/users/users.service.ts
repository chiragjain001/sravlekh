import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Get a user by ID — enforces tenant isolation. */
  async findById(userId: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
        instituteId: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    // Tenant isolation — users can only see users within their own institute,
    // except Founders who have cross-institute read (logged separately).
    if (
      actor.role !== UserRole.FOUNDER &&
      user.instituteId !== actor.instituteId
    ) {
      throw new ForbiddenException("You don't have access to this.");
    }

    return user;
  }

  /** Admin/Founder: list all users in an institute. */
  async findAllByInstitute(instituteId: string, actor: AuthenticatedUser) {
    if (
      actor.role !== UserRole.FOUNDER &&
      actor.instituteId !== instituteId
    ) {
      throw new ForbiddenException("You don't have access to this.");
    }

    return this.prisma.user.findMany({
      where: { instituteId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Admin: suspend or reactivate a user within the same institute. */
  async updateStatus(
    userId: string,
    status: UserStatus,
    actor: AuthenticatedUser,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    if (actor.instituteId !== user.instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }

    // Admins cannot change their own status or a Founder's status
    if (user.id === actor.id || user.role === UserRole.FOUNDER) {
      throw new ForbiddenException('This action is not permitted.');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, email: true, status: true },
    });
  }
}
