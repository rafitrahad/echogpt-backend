import { RoleName } from '../enums';

/** What we put INSIDE an access token (the JWT "payload") */
export interface JwtAccessPayload {
  sub: string; // user id ("subject", a JWT standard name)
  email: string;
  role: RoleName;
}

/** The logged-in user, attached to every authenticated request */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: RoleName;
}