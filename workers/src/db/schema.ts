// workers/src/db/schema.ts - Supabase schema definitions for Cloudflare Workers
import { pgTable, serial, text, timestamp, varchar, decimal, json, integer, pgEnum } from "drizzle-orm/pg-core";

// Agents table (保持与现有 schema 一致)
export const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  bg: text('bg'),
  tags: json('tags').$type<string[]>().default([]),
  chatbot_history: json('chatbot_history').$type<any[]>().default([]),
  avatarUrl: text('avatar_url'),
  // Socket specific fields
  x: decimal('x', { precision: 10, scale: 2 }).default('5'),
  y: decimal('y', { precision: 10, scale: 2 }).default('5'),
  color: varchar('color', { length: 7 }).default('#FF5733'),
  status: varchar('status', { length: 20 }).default('idle'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Thoughts table
export const thoughtTypeEnum = pgEnum('thought_type', ['inner_thought', 'decision', 'conversation']);

export const thoughts = pgTable('thoughts', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').references(() => agents.id).notNull(),
  agentName: varchar('agent_name', { length: 255 }).notNull(),
  type: thoughtTypeEnum('type').notNull(),
  content: text('content').notNull(),
  
  // 元数据字段
  confidence: integer('confidence'),
  reasoning: text('reasoning'),
  shouldInitiateChat: integer('should_initiate_chat'),
  emotion: varchar('emotion', { length: 100 }),
  conversationId: varchar('conversation_id', { length: 255 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Activity logs table (保持兼容性)
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').references(() => agents.id),
  action: text('action').notNull(),
  details: json('details'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Conversations table (为 WebSocket 对话功能)
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Messages table (为 WebSocket 对话功能)
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => conversations.id).notNull(),
  agentId: integer('agent_id').references(() => agents.id),
  senderId: text('sender_id').notNull(),
  senderType: text('sender_type').notNull(),
  content: text('content').notNull(),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Memories table (保持兼容性)
export const memories = pgTable('memories', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').references(() => agents.id).notNull(),
  content: text('content').notNull(),
  embedding: text('embedding'), // 在 Cloudflare Workers 中不支持 vector，使用 text 存储
  type: text('type').notNull(),
  importance: integer('importance').default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Type exports for compatibility
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;
export type ThoughtRecord = typeof thoughts.$inferSelect;
export type NewThoughtRecord = typeof thoughts.$inferInsert;