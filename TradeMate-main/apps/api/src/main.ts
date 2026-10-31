import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import { attachMarketFeed } from './market-feed';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Feed attachments are base64-encoded in JSON; cap the request size while
  // allowing four small attachments plus post metadata.
  app.use(json({ limit: '24mb' }));
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
    origin: (origin, callback) => {
      const normalizedOrigin = origin?.replace(/\/+$/, '');
      if (!normalizedOrigin || allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed by TradeMate API CORS policy'), false);
    },
    credentials: true,
  });

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
