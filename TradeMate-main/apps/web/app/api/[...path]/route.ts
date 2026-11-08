import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getApiBase(): string | null {
  // Server-only setting: never expose the upstream API origin in browser bundles.
  const raw = process.env.TRADEMATE_API_ORIGIN?.trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const isLocalHttp = parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (parsed.protocol !== 'https:' && !isLocalHttp) return null;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const apiBase = getApiBase();
  if (!apiBase) {
    return NextResponse.json(
      { message: 'TradeMate API origin is not configured for this environment.' },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const destination = `${apiBase}/api/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  const headers = new Headers();
  for (const name of ['accept', 'authorization', 'content-type', 'cookie', 'x-csrf-token']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const method = request.method;
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  try {
    const upstream = await fetch(destination, {
      method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
    });
    const responseHeaders = new Headers();
    for (const name of ['content-type', 'location', 'cache-control', 'content-disposition']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    const setCookies = upstream.headers.getSetCookie?.() ?? [];
    for (const setCookie of setCookies) responseHeaders.append('set-cookie', setCookie);
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return NextResponse.json({ message: 'TradeMate API is temporarily unreachable. Please try again.' }, { status: 502 });
  }
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
