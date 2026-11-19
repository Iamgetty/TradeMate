import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';

const STANDARD_JSON_BODY_LIMIT = '1mb';
const FEED_POST_JSON_BODY_LIMIT = '28mb';

/**
 * Parse JSON once, applying the larger allowance only to feed-post creation.
 * Express sees the externally mounted path, including Nest's global "api" prefix.
 */
export const createApiJsonBodyParser = () => {
  const standardParser = json({ limit: STANDARD_JSON_BODY_LIMIT });
  const feedPostParser = json({ limit: FEED_POST_JSON_BODY_LIMIT });

  return (request: Request, response: Response, next: NextFunction) => {
    const isFeedPostUpload = request.method === 'POST'
      && request.path === '/api/feed/posts';
    return (isFeedPostUpload ? feedPostParser : standardParser)(request, response, next);
  };
};
