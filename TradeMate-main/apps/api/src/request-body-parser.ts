import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';

const STANDARD_JSON_BODY_LIMIT = '1mb';
const LARGE_UPLOAD_JSON_BODY_LIMIT = '28mb';

const isLargeJsonUploadRequest = (method: string, path: string) => {
  if (method !== 'POST') return false;
  if (path === '/api/feed/posts' || path === '/api/documents') return true;
  return /^\/api\/organizations\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/documents\/?$/i.test(path);
};

/**
 * Parse JSON once, applying the larger allowance only to the document-vault and two existing upload endpoints
 * that accept up to four Base64-encoded 5 MiB uploads.
 */
export const createApiJsonBodyParser = () => {
  const capturePersonaRawBody = (request: Request, _response: Response, buffer: Buffer) => {
    if (request.originalUrl.split('?')[0] === '/api/integrations/persona/webhook') {
      (request as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    }
  };
  const standardParser = json({ limit: STANDARD_JSON_BODY_LIMIT, verify: capturePersonaRawBody });
  const largeUploadParser = json({ limit: LARGE_UPLOAD_JSON_BODY_LIMIT, verify: capturePersonaRawBody });

  return (request: Request, response: Response, next: NextFunction) => {
    const parser = isLargeJsonUploadRequest(request.method, request.path)
      ? largeUploadParser
      : standardParser;
    return parser(request, response, next);
  };
};
