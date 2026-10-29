import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool | null;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    this.pool = connectionString
      ? new Pool({
          connectionString,
          ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
          connectionTimeoutMillis: 5000,
          max: 5,
        })
      : null;
  }

  async checkConnection(): Promise<{ configured: boolean; connected: boolean }> {
    if (!this.pool) return { configured: false, connected: false };
    try {
      await this.pool.query('SELECT 1');
      return { configured: true, connected: true };
    } catch {
      return { configured: true, connected: false };
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) await this.pool.end();
  }
}
