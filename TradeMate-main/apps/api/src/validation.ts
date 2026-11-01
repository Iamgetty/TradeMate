import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

/**
 * Parse untrusted request data at the API boundary.
 * Strict object schemas reject unexpected keys instead of silently accepting them.
 */
export const parseBody = <T extends z.ZodType>(schema: T, input: unknown): z.infer<T> => {
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
  code: z.string().regex(/^\d{6}$/, 'Enter the six-digit authenticator code.'),
}).strict();

export const totpChallengeBodySchema = z.object({
  challengeToken: z.string().min(40).max(128),
  code: z.string().regex(/^\d{6}$/, 'Enter the six-digit authenticator code.'),
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
  instagramUsername: z.string().trim().max(30).regex(/^[A-Za-z0-9._]*$/).optional(),
  xUsername: z.string().trim().max(15).regex(/^[A-Za-z0-9_]*$/).optional(),
  websiteUrl: z.string().trim().max(2048).refine((value) => value === '' || /^https:\/\//i.test(value), 'Enter a valid HTTPS website URL.').optional(),
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

export const supportTicketBodySchema = z.object({
  category: z.enum(['Account & security', 'Orders', 'P2P & payments', 'Listings & selling', 'Report a user or scam', 'Technical issue', 'Other']),
  subject: z.string().trim().min(2).max(180),
  message: z.string().trim().min(5).max(10000),
}).strict();

export const supportReplyBodySchema = z.object({
  message: z.string().trim().min(1).max(10000),
}).strict();

export const feedbackBodySchema = z.object({
  type: z.enum(['Idea', 'Bug', 'Complaint', 'Praise']),
  message: z.string().trim().min(3).max(10000),
}).strict();

export const organizationCreateBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  organizationType: z.enum(['business', 'sole_trader', 'service_provider']),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  defaultCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
}).strict();

export const organizationNameBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
}).strict();

const documentBase64Schema = z.string().min(1).max(7_000_000).regex(/^(?:data:[^,]+,)?[A-Za-z0-9+/]+=*$/);

export const organizationDocumentsBodySchema = z.object({
  files: z.array(z.object({
    fileName: z.string().trim().min(1).max(180),
    mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
    dataBase64: documentBase64Schema,
  }).strict()).min(1).max(4),
}).strict();

const priceInputSchema = z.union([z.string(), z.number()]).refine((value) => {
  const text = String(value).trim();
  return /^\d{1,12}(?:\\.\d{1,2})?$/.test(text) && Number.isSafeInteger(Math.round(Number(text) * 100));
}, 'Enter a valid price with up to two decimal places.');

const quantityInputSchema = z.union([z.string(), z.number()]).nullable().optional().refine((value) => {
  if (value === null || value === undefined || String(value).trim() === '') return true;
  return /^\d{1,12}$/.test(String(value).trim()) && Number.isSafeInteger(Number(value));
}, 'Quantity must be a whole number, or leave it blank.');

export const listingBodySchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(5000).optional(),
  listingType: z.enum(['b2b', 'service']),
  price: priceInputSchema,
  quantityAvailable: quantityInputSchema,
}).strict();

export const enquiryCreateBodySchema = z.object({
  listingId: z.string().uuid(),
  message: z.string().trim().min(5).max(2000),
}).strict();

export const enquiryReplyBodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
}).strict();

const validDateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) =>
  !Number.isNaN(Date.parse(value)) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value,
  'Use a valid date in YYYY-MM-DD format.',
);

export const contractCreateBodySchema = z.object({
  listingId: z.string().uuid(),
  amount: priceInputSchema,
  scope: z.string().trim().min(5).max(5000),
  terms: z.string().trim().min(5).max(10000),
  startDate: z.union([validDateInput, z.literal('')]).optional(),
  completionDate: z.union([validDateInput, z.literal('')]).optional(),
}).strict();

export const contractDecisionBodySchema = z.object({
  decision: z.enum(['accept', 'reject']),
}).strict();

export const contractMessageBodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
}).strict();

const positiveNumberInput = z.union([z.number(), z.string()]).refine((value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}, 'Enter a valid positive amount.');

const nonNegativeNumberInput = z.union([z.number(), z.string()]).refine((value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}, 'Enter a valid non-negative amount.');

export const p2pAdBodySchema = z.object({
  side: z.enum(['buy', 'sell']),
  asset: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,16}$/),
  fiat: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  price: positiveNumberInput,
  quantity: positiveNumberInput,
  minFiatAmount: nonNegativeNumberInput.optional(),
  maxFiatAmount: nonNegativeNumberInput.optional(),
  paymentMethods: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
}).strict();

export const p2pOrderBodySchema = z.object({
  adId: z.string().uuid(),
  fiatAmount: positiveNumberInput,
}).strict();

export const p2pPaymentSentBodySchema = z.object({
  reference: z.string().trim().max(160).optional(),
}).strict();

export const p2pDisputeBodySchema = z.object({
  reason: z.string().trim().min(5).max(1000),
}).strict();

export const feedCommentBodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
}).strict();

export const feedReportBodySchema = z.object({
  postId: z.string().uuid().optional(),
  commentId: z.string().uuid().optional(),
  reason: z.string().trim().min(3).max(1000),
}).strict().refine((value) => Boolean(value.postId) !== Boolean(value.commentId), {
  message: 'Report exactly one valid post or comment.',
});

export const feedModerationBodySchema = z.object({
  action: z.enum(['hide', 'dismiss']),
}).strict();

export const announcementBodySchema = z.object({
  body: z.string().trim().min(1).max(5000),
}).strict();

export const reviewDecisionBodySchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(1000).optional(),
}).strict();

export const parseUuidParam = (value: string, message = 'Invalid identifier.') => {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) throw new BadRequestException(message);
  return parsed.data;
};
