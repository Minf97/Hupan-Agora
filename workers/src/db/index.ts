// workers/src/db/index.ts - Supabase connection for Cloudflare Workers
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Database connection function for Cloudflare Workers
export function createDatabaseConnection(databaseUrl: string) {
  console.log(
    "Creating database connection with URL:",
    databaseUrl ? "URL provided" : "No URL"
  );

  // 检查数据库URL格式
  if (!databaseUrl || !databaseUrl.startsWith("postgresql://")) {
    throw new Error("Invalid or missing DATABASE_URL");
  }

  const client = postgres(databaseUrl);

  return drizzle({ client, schema });
}

// Type for database instance
export type Database = ReturnType<typeof createDatabaseConnection>;
