import { createHmac, timingSafeEqual } from 'node:crypto';

export const verifyPersonaWebhookSignature = (
  rawBody: Buffer,
  signatureHeader: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean => {
  if (!rawBody.length || !signatureHeader || !secret) return false;
  for (const signatureSet of signatureHeader.trim().split(/\\s+/)) {
    const timestampMatch = signatureSet.match(/(?:^|,)t=(\\d+)/);
    const signatureMatch = signatureSet.match(/(?:^|,)v1=([a-f0-9]{64})(?:,|$)/i);
    if (!timestampMatch || !signatureMatch) continue;
    const timestamp = Number(timestampMatch[1]);
    if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) continue;
    const expected = createHmac('sha256', secret)
      .update(String(timestamp) + '.' + rawBody.toString('utf8'))
      .digest();
    const supplied = Buffer.from(signatureMatch[1], 'hex');
    if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) return true;
  }
  return false;
};
