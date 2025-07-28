// 添加示例agents到数据库
const { config } = require('dotenv');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

config({ path: '.env.local' });

const client = postgres(process.env.DATABASE_URL);
const db = drizzle({ client });

// 直接定义schema
const { pgTable, serial, text, timestamp, varchar, decimal } = require('drizzle-orm/pg-core');

const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  personality: text('personality').notNull(),
  backstory: text('backstory'),
  goals: text('goals'),
  avatarUrl: text('avatar_url'),
  x: decimal('x', { precision: 10, scale: 2 }).default('5'),
  y: decimal('y', { precision: 10, scale: 2 }).default('5'),
  color: varchar('color', { length: 7 }).default('#FF5733'),
  status: varchar('status', { length: 20 }).default('idle'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

async function seedAgents() {
  try {
    console.log('开始添加示例agents...');

    const sampleAgents = [
      {
        name: 'Mike',
        personality: '开朗活泼的AI助手',
        description: '一个友善的AI角色，喜欢帮助他人',
        backstory: 'Mike是一个充满活力的AI，总是乐于助人。',
        goals: '帮助用户解决问题，创造友好的互动体验',
        x: '5',
        y: '5',
        color: '#FF5733',
        status: 'idle'
      },
      {
        name: 'Cassin',
        personality: '冷静理性的AI分析师',
        description: '擅长逻辑思考和数据分析的AI角色',
        backstory: 'Cassin是一个善于分析的AI，喜欢深入思考问题。',
        goals: '提供准确的分析和建议',
        x: '15',
        y: '10',
        color: '#33A1FF',
        status: 'idle'
      },
      {
        name: 'Dax',
        personality: '创意无限的AI艺术家',
        description: '富有创造力的AI角色，喜欢艺术和设计',
        backstory: 'Dax是一个充满想象力的AI，热爱创作和美学。',
        goals: '激发创意，创造美好的艺术作品',
        x: '8',
        y: '18',
        color: '#33FF57',
        status: 'idle'
      },
      {
        name: 'Roland',
        personality: '冷静理性的AI分析师',
        description: '擅长逻辑思考和数据分析的AI角色',
        backstory: 'Roland是一个善于分析的AI，喜欢深入思考问题。',
        goals: '提供准确的分析和建议',
        x: '15',
        y: '10',
        color: '#33A1FF',
        status: 'idle'
      },
      {
        name: 'Sue',
        personality: '创意无限的AI艺术家',
        description: '富有创造力的AI角色，喜欢艺术和设计',
        backstory: 'Sue是一个充满想象力的AI，热爱创作和美学。',
        goals: '激发创意，创造美好的艺术作品',
        x: '8',
        y: '18',
        color: '#33FF57',
        status: 'idle'
      }
    ];

    for (const agentData of sampleAgents) {
      try {
        const result = await db.insert(agents).values(agentData).returning();
        const agent = result[0];
        console.log(`✓ 创建agent: ${agent.name} (ID: ${agent.id})`);
      } catch (error) {
        if (error.code === '23505') { // unique constraint violation
          console.log(`- Agent ${agentData.name} 已存在，跳过`);
        } else {
          console.error(`✗ 创建agent ${agentData.name} 失败:`, error.message);
        }
      }
    }

    console.log('示例agents添加完成！');
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('添加示例agents失败:', error);
    await client.end();
    process.exit(1);
  }
}

seedAgents();