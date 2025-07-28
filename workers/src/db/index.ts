// workers/src/db/index.ts - Supabase connection for Cloudflare Workers
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Database connection function for Cloudflare Workers
export function createDatabaseConnection(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    ssl: 'require',
    max: 1, // Important for Cloudflare Workers
    idle_timeout: 20,
    connect_timeout: 10,
  });
  
  return drizzle(client, { schema });
}

// Type for database instance
export type Database = ReturnType<typeof createDatabaseConnection>;