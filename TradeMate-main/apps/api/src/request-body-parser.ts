import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';

const STANDARD_JSON_BODY_LIMIT = '1mb';
const LARGE_UPLOAD_JSON_BODY_LIMIT = '28mb';

const isLargeJsonUploadRequest = (method: string, path: string) => {
  if (method !== 'POST') return false;
  if (path === '/api/feed/posts') return true;
  return /^\/api\/organizations\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/documents\/?$/i.test(path);
};

/**
 * Parse JSON once, applying the larger allowance only to the two endpoints
 * that accept up to four Base64-encoded 5 MiB uploads.
 */
export const createApiJsonBodyParser = () => {
  const standardParser = json({ limit: STANDARD_JSON_BODY_LIMIT });
  const largeUploadParser = json({ limit: LARGE_UPLOAD_JSON_BODY_LIMIT });

  return (request: Request, response: Response, next: NextFunction) => {
    const parser = isLargeJsonUploadRequest(request.method, request.path)
      ? largeUploadParser
      : standardParser;
    return parser(request, response, next);
  };
};
