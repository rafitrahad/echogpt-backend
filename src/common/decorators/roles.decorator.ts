import { SetMetadata } from '@nestjs/common';
import { RoleName } from '../enums';

export const ROLES_KEY = 'roles';

/** Restricts a route to specific roles, e.g. @Roles(RoleName.ADMIN) */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);