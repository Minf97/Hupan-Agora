import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { agents } from "./agents";
import { relations } from "drizzle-orm";

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => conversations.id).notNull(),
  agentId: integer('agent_id').references(() => agents.id),
  senderId: text('sender_id').notNull(), // 可以是用户ID或者Agent ID
  senderType: text('sender_type').notNull(), // "user" 或 "agent"
  content: text('content').notNull(),
  metadata: jsonb('metadata'), // 可以存储额外的消息信息
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages)
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  agent: one(agents, {
    fields: [messages.agentId],
    references: [agents.id],
  }),
}));

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert; 