import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Gives a controller method the logged-in user.
 *   @CurrentUser() user          -> the whole AuthenticatedUser
 *   @CurrentUser('id') userId    -> just one field
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);