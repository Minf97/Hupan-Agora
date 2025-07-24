import { pgTable, serial, text, timestamp, varchar, decimal } from "drizzle-orm/pg-core";

export const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  personality: text('personality').notNull(),
  backstory: text('backstory'),
  goals: text('goals'),
  avatarUrl: text('avatar_url'),
  // Socket specific fields
  x: decimal('x', { precision: 10, scale: 2 }).default('5'),
  y: decimal('y', { precision: 10, scale: 2 }).default('5'),
  color: varchar('color', { length: 7 }).default('#FF5733'),
  status: varchar('status', { length: 20 }).default('idle'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert; 