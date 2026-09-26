import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * One reusable rule for every NEW password (register, change password):
 * 8-72 chars with an uppercase letter, a lowercase letter and a number.
 */
export function IsSecurePassword() {
  return applyDecorators(
    IsString(),
    MinLength(8),
    MaxLength(72), // bcrypt only uses the first 72 bytes
    Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message: 'password must contain an uppercase letter, a lowercase letter and a number',
    }),
  );
}