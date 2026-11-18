import { expect, test } from '@playwright/test';
import { GET as searchNfts } from '../app/api/nfts/route';
import { GET as listCollections } from '../app/api/nft-collections/route';

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENSEA_API_KEY;

test.describe('OpenSea NFT route resilience', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENSEA_API_KEY;
    else process.env.OPENSEA_API_KEY = originalApiKey;
  });

  test('NFT search reports an unconfigured provider without making an upstream request', async () => {
    delete process.env.OPENSEA_API_KEY;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      throw new Error('unexpected OpenSea request');
    }) as typeof fetch;

    const response = await searchNfts(new Request('https://web.example/api/nfts?search=art'));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ configured: false, items: [] });
    expect(called).toBe(false);
  });

  test('NFT search bounds the OpenSea search request with an abort signal', async () => {
    process.env.OPENSEA_API_KEY = 'test-key';
    let capturedSignal: AbortSignal | null = null;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const response = await searchNfts(new Request('https://web.example/api/nfts?search=art'));
    expect(response.status).toBe(200);
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal?.aborted).toBe(false);
  });

  test('collection discovery bounds the OpenSea request with an abort signal', async () => {
    process.env.OPENSEA_API_KEY = 'test-key';
    let capturedSignal: AbortSignal | null = null;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Response(JSON.stringify({ collections: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const response = await listCollections(new Request('https://web.example/api/nft-collections'));
    expect(response.status).toBe(200);
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal?.aborted).toBe(false);
  });
});
