import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const runMigrations = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  // 先创建pgvector扩展
  console.log('创建pgvector扩展...');
  await sql`CREATE EXTENSION IF NOT EXISTS vector;`;

  console.log('运行迁移...');
  await migrate(db, { migrationsFolder: 'db/migrations' });
  console.log('迁移完成!');
};

runMigrations().catch((err) => {
  console.error('迁移失败:', err);
  process.exit(1);
}); 