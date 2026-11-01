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

export const preferencesBodySchema = z.object({
  cur: z.enum(['NGN', 'USD', 'EUR', 'GBP', 'GHS', 'KES']).optional(),
  market: z.enum(['Services', 'B2B', 'Real Estate', 'Software', 'NFTs', 'Forex', 'Crypto', 'P2P']).optional(),
  orders: z.boolean().optional(),
  p2p: z.boolean().optional(),
  promos: z.boolean().optional(),
  news: z.boolean().optional(),
  language: z.enum(['English', 'Français', 'Hausa', 'Yorùbá', 'Igbo', 'Kiswahili', 'Português', 'العربية']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'No supported preferences were supplied.',
});

const profileImageSchema = z.string().max(900000).refine(
  (value) => value === '' || /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value),
  'Profile images must be JPEG, PNG or WebP and smaller than 650 KB each.',
);

export const publicProfileBodySchema = z.object({
  bio: z.string().max(160).optional(),
  instagramUsername: z.string().max(30).regex(/^[A-Za-z0-9._]*$/).optional(),
  xUsername: z.string().max(15).regex(/^[A-Za-z0-9_]*$/).optional(),
  websiteUrl: z.string().max(2048).refine((value) => value === '' || /^https:\/\//i.test(value), 'Enter a valid HTTPS website URL.').optional(),
  profilePhotoData: profileImageSchema.optional(),
  coverPhotoData: profileImageSchema.optional(),
  highlights: z.array(z.object({
    id: z.string().min(1).max(100),
    title: z.string().max(20),
    img: z.string().max(700000),
  }).strict()).max(12).optional(),
}).strict();

export const feedPostBodySchema = z.object({
  type: z.enum(['post', 'feedback']),
  title: z.string().trim().min(1).max(140),
  body: z.string().trim().min(1).max(5000),
  attachments: z.array(z.object({
    name: z.string().trim().min(1).max(180),
    type: z.string().min(1).max(128),
    data: z.string().min(1).max(7_000_000),
  }).strict()).max(4).optional(),
}).strict();
