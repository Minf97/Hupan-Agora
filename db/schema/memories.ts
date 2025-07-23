import { pgTable, serial, text, timestamp, integer, vector } from "drizzle-orm/pg-core";
import { agents } from "./agents";
import { relations } from "drizzle-orm";

// 我们将使用1536维向量（适合OpenAI嵌入模型）
export const VECTOR_DIMENSIONS = 1536;

export const memories = pgTable('memories', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').references(() => agents.id).notNull(),
  content: text('content').notNull(),
  // 使用pgvector存储嵌入向量
  embedding: vector('embedding', { dimensions: VECTOR_DIMENSIONS }).notNull(),
  // 记忆类型（观察、想法、对话等）
  type: text('type').notNull(),
  // 记忆的重要性评分（用于衰减和检索）
  importance: integer('importance').default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const memoriesRelations = relations(memories, ({ one }) => ({
  agent: one(agents, {
    fields: [memories.agentId],
    references: [agents.id],
  }),
}));

export type Memory = typeof memories.$inferSelect;
export type InsertMemory = typeof memories.$inferInsert; 