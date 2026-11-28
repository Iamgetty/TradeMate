import { createServer as createNodeServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const API_VERSION = 'v1';
const CATALOG_URL = new URL('../../../packages/verification-cli/catalog/products.json', import.meta.url);

interface CatalogueRelease { version: string; status: string }
interface CatalogueProduct { id: string; name: string; description: string; versions: CatalogueRelease[] }
interface ProductCatalogue { schemaVersion: number; products: CatalogueProduct[] }

let cachedCatalogue: ProductCatalogue | undefined;
async function loadCatalogue(): Promise<ProductCatalogue> {
  if (!cachedCatalogue) {
    const parsed = JSON.parse(await readFile(fileURLToPath(CATALOG_URL), 'utf8')) as ProductCatalogue;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.products)) throw new Error('Product catalogue schema is invalid.');
    cachedCatalogue = parsed;
  }
  return cachedCatalogue;
}
function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(body));
}
function requestId(): string { return crypto.randomUUID(); }

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const id = requestId();
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (method !== 'GET' && method !== 'HEAD') {
    response.setHeader('allow', 'GET, HEAD');
    sendJson(response, 405, { error: { code: 'method_not_allowed', message: 'Only GET and HEAD are supported.', requestId: id } });
    return;
  }
  if (url.pathname === '/health/live') {
    sendJson(response, 200, { status: 'ok', service: 'verifire', requestId: id });
    return;
  }
  if (url.pathname === '/health/ready') {
    try { await loadCatalogue(); sendJson(response, 200, { status: 'ready', checks: { productCatalogue: 'ok' }, requestId: id }); }
    catch { sendJson(response, 503, { status: 'not_ready', checks: { productCatalogue: 'unavailable' }, requestId: id }); }
    return;
  }
  if (url.pathname === `/${API_VERSION}/products`) {
    try {
      const catalogue = await loadCatalogue();
      sendJson(response, 200, { apiVersion: API_VERSION, products: catalogue.products.map(({ id: productId, name, description, versions }) => ({ id: productId, name, description, versions: versions.map(({ version, status }) => ({ version, status })) })), requestId: id });
    } catch {
      sendJson(response, 503, { error: { code: 'catalogue_unavailable', message: 'Product catalogue is temporarily unavailable.', requestId: id } });
    }
    return;
  }
  const versionMatch = new RegExp(`^/${API_VERSION}/products/([a-z][a-z0-9-]*)/versions$`).exec(url.pathname);
  if (versionMatch) {
    try {
      const catalogue = await loadCatalogue();
      const product = catalogue.products.find((item) => item.id === versionMatch[1]);
      if (!product) { sendJson(response, 404, { error: { code: 'product_not_found', message: 'The requested product does not exist.', requestId: id } }); return; }
      sendJson(response, 200, { apiVersion: API_VERSION, product: product.id, versions: product.versions, requestId: id });
    } catch {
      sendJson(response, 503, { error: { code: 'catalogue_unavailable', message: 'Product catalogue is temporarily unavailable.', requestId: id } });
    }
    return;
  }
  sendJson(response, 404, { error: { code: 'not_found', message: 'The requested endpoint does not exist.', requestId: id } });
}
export function createVerificationServer(): Server {
  return createNodeServer((request, response) => {
    void route(request, response).catch(() => {
      if (!response.headersSent) sendJson(response, 500, { error: { code: 'internal_error', message: 'An unexpected error occurred.', requestId: requestId() } });
      else response.destroy();
    });
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number.parseInt(process.env.PORT ?? '8080', 10);
  const host = process.env.HOST ?? '0.0.0.0';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  const server = createVerificationServer();
  server.listen(port, host, () => process.stdout.write(`VeriFire service listening on ${host}:${port}\n`));
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
