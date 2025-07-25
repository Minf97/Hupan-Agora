// db/schema/thoughts.ts - 思考记录表定义

import { pgTable, serial, integer, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { agents } from './agents';

// 思考记录类型枚举
export const thoughtTypeEnum = pgEnum('thought_type', ['inner_thought', 'decision', 'conversation']);

// 思考记录表
export const thoughts = pgTable('thoughts', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').references(() => agents.id).notNull(),
  agentName: varchar('agent_name', { length: 255 }).notNull(),
  type: thoughtTypeEnum('type').notNull(),
  content: text('content').notNull(),
  
  // 元数据字段
  confidence: integer('confidence'), // 存储为0-100的整数
  reasoning: text('reasoning'),
  shouldInitiateChat: integer('should_initiate_chat'), // 使用 0/1 表示 false/true
  emotion: varchar('emotion', { length: 100 }),
  conversationId: varchar('conversation_id', { length: 255 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ThoughtRecord = typeof thoughts.$inferSelect;
export type NewThoughtRecord = typeof thoughts.$inferInsert;