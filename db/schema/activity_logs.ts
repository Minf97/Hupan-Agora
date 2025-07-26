// db/schema/activity_logs.ts - 活动日志表定义

import { pgTable, serial, integer, varchar, text, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { agents } from './agents';
import { conversations } from './conversations';
import { memories } from './memories';
import { relations } from 'drizzle-orm';

// 活动日志类型枚举
export const activityTypeEnum = pgEnum('activity_type', [
  'conversation_start',
  'conversation_end', 
  'conversation_message',
  'status_change',
  'location_change',
  'memory_created',
  'memory_accessed'
]);

// 活动日志表
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  
  // 基本信息
  type: activityTypeEnum('type').notNull(),
  agentId: integer('agent_id').references(() => agents.id).notNull(),
  agentName: varchar('agent_name', { length: 255 }).notNull(),
  content: text('content').notNull(),
  
  // 关联信息
  targetAgentId: integer('target_agent_id').references(() => agents.id),
  targetAgentName: varchar('target_agent_name', { length: 255 }),
  conversationId: integer('conversation_id').references(() => conversations.id),
  memoryId: integer('memory_id').references(() => memories.id),
  
  // 元数据 - 存储额外信息
  metadata: jsonb('metadata'), // 可以存储位置、状态变化等信息
  
  // 时间戳
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 关系定义
export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  agent: one(agents, {
    fields: [activityLogs.agentId],
    references: [agents.id],
  }),
  targetAgent: one(agents, {
    fields: [activityLogs.targetAgentId],
    references: [agents.id],
  }),
  conversation: one(conversations, {
    fields: [activityLogs.conversationId],
    references: [conversations.id],
  }),
  memory: one(memories, {
    fields: [activityLogs.memoryId],
    references: [memories.id],
  }),
}));

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;