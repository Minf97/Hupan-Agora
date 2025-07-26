// lib/thoughts-service-cjs.js - CommonJS版本的思考记录服务

const { config } = require('dotenv');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { pgTable, serial, text, timestamp, integer, varchar, pgEnum } = require('drizzle-orm/pg-core');

config({ path: '.env.local' });

const client = postgres(process.env.DATABASE_URL);
const db = drizzle({ client });

// 思考记录类型枚举
const thoughtTypeEnum = pgEnum('thought_type', ['inner_thought', 'decision', 'conversation']);

// Define thoughts schema (CommonJS version)
const thoughts = pgTable('thoughts', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull(),
  agentName: varchar('agent_name', { length: 255 }).notNull(),
  type: thoughtTypeEnum('type').notNull(),
  content: text('content').notNull(),
  confidence: integer('confidence'),
  reasoning: text('reasoning'),
  shouldInitiateChat: integer('should_initiate_chat'),
  emotion: varchar('emotion', { length: 100 }),
  conversationId: varchar('conversation_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 添加思考记录到数据库 (CommonJS版本)
async function addThought(thought) {
  try {
    const newThought = {
      agentId: thought.agentId,
      agentName: thought.agentName,
      type: thought.type,
      content: thought.content,
      confidence: thought.metadata?.confidence ? Math.round(thought.metadata.confidence * 100) : null,
      reasoning: thought.metadata?.reasoning || null,
      shouldInitiateChat: thought.metadata?.shouldInitiateChat ? 1 : 0,
      emotion: thought.metadata?.emotion || null,
      conversationId: thought.metadata?.conversationId || null,
    };

    const [insertedThought] = await db.insert(thoughts).values(newThought).returning();
    
    // 转换为前端格式
    return {
      id: insertedThought.id.toString(),
      timestamp: insertedThought.createdAt.getTime(),
      agentId: insertedThought.agentId,
      agentName: insertedThought.agentName,
      type: insertedThought.type,
      content: insertedThought.content,
      metadata: {
        confidence: insertedThought.confidence ? insertedThought.confidence / 100 : undefined,
        reasoning: insertedThought.reasoning || undefined,
        shouldInitiateChat: insertedThought.shouldInitiateChat === 1,
        emotion: insertedThought.emotion || undefined,
        conversationId: insertedThought.conversationId || undefined,
      }
    };
  } catch (error) {
    console.error('添加思考记录失败:', error);
    throw error;
  }
}

module.exports = {
  addThought
};