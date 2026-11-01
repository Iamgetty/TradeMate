import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

/**
 * Parse untrusted request data at the API boundary.
 * Strict object schemas reject unexpected keys instead of silently accepting them.
 */
export const parseBody = <T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> => {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.issues[0]?.message || 'The request contains invalid data.');
  }
  return parsed.data;
};

export const registerBodySchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254),
  password: z.string().min(12, 'Use a password between 12 and 128 characters.').max(128),
  displayName: z.string().trim().min(2, 'Your name must be between 2 and 80 characters.').max(80),
}).strict();

export const loginBodySchema = z.object({
  email: z.string().trim().email('Email or password is incorrect.').max(254),
  password: z.string().min(1, 'Email or password is incorrect.').max(128),
}).strict();

export const displayNameBodySchema = z.object({
  displayName: z.string().trim().min(2).max(24),
}).strict();

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
}).strict().refine((value) => value.currentPassword !== value.newPassword, {
  message: 'Choose a password you have not used for this change.',
});

export const totpCodeBodySchema = z.object({
  code: z.string().regex(/^\\d{6}$/, 'Enter the six-digit authenticator code.'),
}).strict();

export const totpChallengeBodySchema = z.object({
  challengeToken: z.string().min(40).max(128),
  code: z.string().regex(/^\\d{6}$/, 'Enter the six-digit authenticator code.'),
}).strict();

export const deletionRequestBodySchema = z.object({
  password: z.string().min(1).max(128),
}).strict();

export const deletionCancelBodySchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/, 'Enter a valid cancellation token.'),
}).strict();
