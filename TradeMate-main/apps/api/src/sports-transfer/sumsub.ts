import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface SumsubWebhookEvent {
  eventId: string;
  externalUserId: string;
  outcome: 'succeeded' | 'failed' | 'review_required';
  occurredAt: Date | null;
  payloadSha256: string;
}

export interface SumsubSession {
  externalUserId: string;
  accessToken: string;
  expiresAt: Date;
}

type SumsubConfig = {
  appToken: string;
  secretKey: string;
  levelName: string;
  baseUrl: string;
};

const config = (): SumsubConfig => {
  const appToken = process.env.SUMSUB_APP_TOKEN || '';
  const secretKey = process.env.SUMSUB_SECRET_KEY || '';
  const levelName = process.env.SUMSUB_KYC_LEVEL_NAME || '';
  if (!appToken || !secretKey || !levelName) {
    throw new Error('Sumsub is not configured. Set SUMSUB_APP_TOKEN, SUMSUB_SECRET_KEY and SUMSUB_KYC_LEVEL_NAME.');
  }
  return {
    appToken,
    secretKey,
    levelName,
    // Sumsub documents api.sumsub.com for both Sandbox and Production;
    // the app-token pair determines the environment.
    baseUrl: 'https://api.sumsub.com',
  };
};

const request = async <T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> => {
  const settings = config();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodyText = body === undefined ? '' : JSON.stringify(body);
  const signature = createHmac('sha256', settings.secretKey)
    .update(timestamp + method + path + bodyText)
    .digest('hex');
  const response = await fetch(settings.baseUrl + path, {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-App-Token': settings.appToken,
      'X-App-Access-Ts': timestamp,
      'X-App-Access-Sig': signature,
    },
    ...(bodyText ? { body: bodyText } : {}),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    // Do not forward provider response bodies: they can contain personal data.
    throw new Error('Sumsub API request failed with HTTP ' + response.status + '.');
  }
  return response.json() as Promise<T>;
};

export const createSumsubWebSdkSession = async (caseId: string, ttlInSecs = 600): Promise<SumsubSession> => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(caseId)) {
    throw new Error('A valid TradeMate verification case ID is required.');
  }
  if (!Number.isInteger(ttlInSecs) || ttlInSecs < 60 || ttlInSecs > 3600) {
    throw new Error('Sumsub WebSDK token lifetime must be between 60 and 3,600 seconds.');
  }
  const settings = config();
  const path = '/resources/accessTokens/sdk';
  const payload = { userId: caseId, levelName: settings.levelName, ttlInSecs };
  const result = await request<{ token?: string; userId?: string }>('POST', path, payload);
  if (typeof result.token !== 'string' || !result.token || result.userId !== caseId) {
    throw new Error('Sumsub returned an invalid WebSDK access-token response.');
  }
  return {
    externalUserId: caseId,
    accessToken: result.token,
    expiresAt: new Date(Date.now() + ttlInSecs * 1000),
  };
};

export const getSumsubApplicantStatus = async (externalUserId: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(externalUserId)) {
    throw new Error('A valid TradeMate verification case reference is required.');
  }
  const path = '/resources/applicants/-;externalUserId=' + encodeURIComponent(externalUserId) + '/one';
  const applicant = await request<any>('GET', path);
  const review = applicant?.review || {};
  const reviewStatus = String(review.reviewStatus || 'init');
  const answer = String(review.reviewResult?.reviewAnswer || '');
  const status = reviewStatus === 'completed' ? 'completed'
    : ['pending', 'prechecked', 'queued', 'onHold', 'awaitingService', 'awaitingUser'].includes(reviewStatus) ? 'submitted'
    : 'created';
  const outcome = reviewStatus !== 'completed' ? 'review_required'
    : answer === 'GREEN' ? 'succeeded'
    : answer === 'RED' ? 'failed' : 'review_required';
  return {
    externalUserId,
    status,
    outcome,
    checkedAt: new Date(),
  } as const;
};

export const verifySumsubWebhook = (
  rawBody: Buffer,
  headers: Readonly<Record<string, string | undefined>>,
): SumsubWebhookEvent => {
  const secret = process.env.SUMSUB_WEBHOOK_SECRET || '';
  const digest = headers['x-payload-digest'] || headers['X-Payload-Digest'];
  const algorithm = headers['x-payload-digest-alg'] || headers['X-Payload-Digest-Alg'];
  if (!secret || !digest || !algorithm) throw new Error('Sumsub webhook signature is missing.');
  // SHA-1 is deprecated by Sumsub. Require SHA-256 or SHA-512 for new integrations.
  const algorithms: Record<string, 'sha256' | 'sha512'> = {
    HMAC_SHA256_HEX: 'sha256',
    HMAC_SHA512_HEX: 'sha512',
  };
  const selected = algorithms[algorithm];
  if (!selected || !/^[a-f0-9]+$/i.test(digest)) throw new Error('Sumsub webhook signature algorithm is invalid.');
  const expected = createHmac(selected, secret).update(rawBody).digest();
  const supplied = Buffer.from(digest, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) {
    throw new Error('Sumsub webhook signature is invalid.');
  }
  let payload: any;
  try { payload = JSON.parse(rawBody.toString('utf8')); }
  catch { throw new Error('Sumsub webhook payload is invalid JSON.'); }
  if (!payload || typeof payload !== 'object' || payload.type !== 'applicantReviewed'
    || typeof payload.externalUserId !== 'string' || typeof payload.createdAtMs !== 'string') {
    throw new Error('Sumsub webhook must be an applicantReviewed event with valid correlation fields.');
  }
  // Sumsub's Dashboard "Test webhook" is a delivery diagnostic, not an
  // applicant verification result. Never let it create a review case/event.
  if (payload.testMode === true) {
    throw new Error('Sumsub manual test webhooks are not applicant verification events.');
  }
  const reviewStatus = String(payload.reviewStatus || '');
  const answer = String(payload.reviewResult?.reviewAnswer || '');
  const outcome = reviewStatus !== 'completed' ? 'review_required'
    : answer === 'GREEN' ? 'succeeded'
    : answer === 'RED' ? 'failed' : 'review_required';
  const occurredAt = Date.parse(payload.createdAtMs.replace(' ', 'T') + (/[+-]\d{4}$/.test(payload.createdAtMs) ? '' : 'Z'));
  const payloadSha256 = createHash('sha256').update(rawBody).digest('hex');
  // Sumsub's documented applicant webhook has no universal event ID. Derive a
  // stable inbox key from its event identity fields; exact retries stay idempotent.
  const eventId = createHash('sha256')
    .update([payload.applicantId || payload.externalUserId, payload.type, payload.createdAtMs, payload.correlationId || ''].join('|'))
    .digest('hex');
  return {
    eventId,
    externalUserId: payload.externalUserId,
    outcome,
    occurredAt: Number.isFinite(occurredAt) ? new Date(occurredAt) : null,
    payloadSha256,
  };
};
