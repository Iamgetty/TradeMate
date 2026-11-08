import { expect, test } from '@playwright/test';
import { NextRequest } from 'next/server';
import { GET, HEAD, POST, PUT, PATCH, DELETE } from '../app/api/[...path]/route';

const context = { params: Promise.resolve({ path: ['v1', 'accounts'] }) };

function request(method = 'GET', url = 'https://frontend.example/api/v1/accounts?limit=5', headers?: HeadersInit, body?: string) {
  return new NextRequest(url, { method, headers, body });
}

test.describe('same-origin API proxy', () => {
  test.describe.configure({ mode: 'serial' });

  const originalFetch = globalThis.fetch;
  const originalOrigin = process.env.TRADEMATE_API_ORIGIN;

  test.afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalOrigin === undefined) delete process.env.TRADEMATE_API_ORIGIN;
    else process.env.TRADEMATE_API_ORIGIN = originalOrigin;
  });

  test('returns 503 and does not call upstream when origin is missing', async () => {
    delete process.env.TRADEMATE_API_ORIGIN;
    let called = false;
    globalThis.fetch = (async () => { called = true; throw new Error('unexpected fetch'); }) as typeof fetch;

    const response = await GET(request(), context);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ message: expect.stringContaining('not configured') });
    expect(called).toBe(false);
  });

  test('rejects insecure non-local upstream origins', async () => {
    process.env.TRADEMATE_API_ORIGIN = 'http://api.example.com';
    const response = await GET(request(), context);
    expect(response.status).toBe(503);
  });

  test('forwards path, query, auth and cookies and preserves multiple Set-Cookie headers', async () => {
    process.env.TRADEMATE_API_ORIGIN = 'https://api.example.com/';
    let capturedUrl = '';
    let capturedHeaders: Headers | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedHeaders = new Headers(init?.headers);
      const headers = new Headers({ 'content-type': 'application/json' });
      headers.append('set-cookie', 'session=one; Path=/; HttpOnly');
      headers.append('set-cookie', 'csrf=two; Path=/; Secure');
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }) as typeof fetch;

    const response = await GET(request('GET', undefined, {
      authorization: 'Bearer test-token',
      cookie: 'session=abc',
      accept: 'application/json',
    }), context);

    expect(capturedUrl).toBe('https://api.example.com/api/v1/accounts?limit=5');
    expect(capturedHeaders?.get('authorization')).toBe('Bearer test-token');
    expect(capturedHeaders?.get('cookie')).toBe('session=abc');
    expect(capturedHeaders?.get('accept')).toBe('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  test('forwards write methods, content type, CSRF token and request body', async () => {
    process.env.TRADEMATE_API_ORIGIN = 'https://api.example.com';
    const handlers = { POST, PUT, PATCH, DELETE };
    for (const [method, handler] of Object.entries(handlers)) {
      let capturedMethod = '';
      let capturedBody: BodyInit | null | undefined;
      let capturedHeaders: Headers | undefined;
      globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedMethod = init?.method ?? '';
        capturedBody = init?.body;
        capturedHeaders = new Headers(init?.headers);
        return new Response(null, { status: 204 });
      }) as typeof fetch;

      const response = await handler(request(method, undefined, {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-value',
      }, '{"active":true}'), context);

      expect(response.status).toBe(204);
      expect(capturedMethod).toBe(method);
      const bodyText = capturedBody instanceof ArrayBuffer
        ? new TextDecoder().decode(capturedBody)
        : String(capturedBody ?? '');
      expect(bodyText).toBe('{"active":true}');
      expect(capturedHeaders?.get('content-type')).toBe('application/json');
      expect(capturedHeaders?.get('x-csrf-token')).toBe('csrf-value');
    }
  });

  test('preserves upstream redirect location', async () => {
    process.env.TRADEMATE_API_ORIGIN = 'https://api.example.com';
    globalThis.fetch = (async () => new Response(null, {
      status: 302,
      headers: { location: 'https://api.example.com/login' },
    })) as typeof fetch;

    const response = await GET(request(), context);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://api.example.com/login');
  });

  test('returns 502 when the upstream cannot be reached', async () => {
    process.env.TRADEMATE_API_ORIGIN = 'https://api.example.com';
    globalThis.fetch = (async () => { throw new Error('upstream unavailable'); }) as typeof fetch;

    const response = await GET(request(), context);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ message: expect.stringContaining('unreachable') });
  });

  test('supports HEAD without forwarding a request body', async () => {
    process.env.TRADEMATE_API_ORIGIN = 'https://api.example.com';
    let capturedMethod = '';
    let capturedBody: BodyInit | null | undefined;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedMethod = init?.method ?? '';
      capturedBody = init?.body;
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const response = await HEAD(request('HEAD'), context);
    expect(response.status).toBe(200);
    expect(capturedMethod).toBe('HEAD');
    expect(capturedBody).toBeUndefined();
  });
});
