import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import { attachMarketFeed } from './market-feed';
import { attachMarketHighlights } from './market-highlights';
import { validateEnvironment } from './environment';
import { databaseRequestContextMiddleware } from './database-context';
import { createApiJsonBodyParser } from './request-body-parser';

async function bootstrap() {
  validateEnvironment();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Feed and organization verification uploads use Base64 JSON; keep the larger
  // allowance restricted to those exact upload routes and use a smaller default elsewhere.
  app.use(createApiJsonBodyParser());
  app.use(databaseRequestContextMiddleware);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  attachMarketFeed(app.getHttpServer());
  app.setGlobalPrefix('api');

  // Keep the deployed TradeMate web origin allowed even if a Render env
  // value is accidentally entered with a trailing slash or another origin.
  const configuredOrigins = (process.env.WEB_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowedOrigins = new Set([
    'https://trademate-web.onrender.com',
    'http://localhost:3000',
    ...configuredOrigins,
  ]);

  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean | string | RegExp | Array<string | RegExp>) => void) => {
      const normalizedOrigin = origin?.replace(/\/+$/, '');
      if (!normalizedOrigin || allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed by TradeMate API CORS policy'), false);
    },
    credentials: true,
  });

  // Registered after CORS so the highlights route gets the same CORS headers.
  attachMarketHighlights(app);

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
