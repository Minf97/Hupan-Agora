// CommonJS wrapper for agents service
const { config } = require('dotenv');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { pgTable, serial, text, timestamp, varchar, decimal, json } = require('drizzle-orm/pg-core');
const { eq } = require('drizzle-orm');

config({ path: '.env.local' });

const client = postgres(process.env.DATABASE_URL);
const db = drizzle({ client });

// Define agents schema
const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  bg: text('bg'),
  tags: json('tags').default([]),
  chatbot_history: json('chatbot_history').default([]),
  avatarUrl: text('avatar_url'),
  x: decimal('x', { precision: 10, scale: 2 }).default('5'),
  y: decimal('y', { precision: 10, scale: 2 }).default('5'),
  color: varchar('color', { length: 7 }).default('#FF5733'),
  status: varchar('status', { length: 20 }).default('idle'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 获取所有agent（返回Socket格式）
async function getAllAgents() {
  try {
    const result = await db.select().from(agents);
    return result.map(agent => ({
      id: agent.id,
      name: agent.name,
      x: parseFloat(agent.x || '5'),
      y: parseFloat(agent.y || '5'),
      color: agent.color || '#FF5733',
      status: agent.status || 'idle'
    }));
  } catch (error) {
    console.error('Error fetching agents:', error);
    throw error;
  }
}

// 更新agent位置和状态
async function updateAgentState(agentId, updates) {
  try {
    const updateData = {};
    
    if (updates.x !== undefined) updateData.x = updates.x.toString();
    if (updates.y !== undefined) updateData.y = updates.y.toString();
    if (updates.status !== undefined) updateData.status = updates.status;
    
    const result = await db
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, agentId))
      .returning();
    
    return result[0];
  } catch (error) {
    console.error('Error updating agent state:', error);
    throw error;
  }
}

module.exports = {
  getAllAgents,
  updateAgentState
};