// workers/src/db/services/thoughts.ts - Thoughts database services for Cloudflare Workers
import { desc, eq } from 'drizzle-orm';
import { thoughts, type NewThoughtRecord } from '../schema';
import type { Database } from '../index';

// 与前端的 ThoughtRecord 接口兼容的类型转换
export interface ThoughtRecord {
  id: string;
  timestamp: number;
  agentId: number;
  agentName: string;
  type: 'inner_thought' | 'decision' | 'conversation';
  content: string;
  metadata?: {
    confidence?: number;
    reasoning?: string;
    shouldInitiateChat?: boolean;
    emotion?: string;
    conversationId?: string;
  };
}

// 添加思考记录到数据库
export async function addThought(
  db: Database,
  thought: Omit<ThoughtRecord, 'id' | 'timestamp'>
) {
  try {
    const newThought: NewThoughtRecord = {
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
    return dbThoughtToFrontend(insertedThought);
  } catch (error) {
    console.error('添加思考记录失败:', error);
    throw error;
  }
}

// 获取最近的思考记录
export async function getRecentThoughts(db: Database, limit: number = 50): Promise<ThoughtRecord[]> {
  try {
    const recentThoughts = await db
      .select()
      .from(thoughts)
      .orderBy(desc(thoughts.createdAt))
      .limit(limit);

    return recentThoughts.map(dbThoughtToFrontend);
  } catch (error) {
    console.error('获取思考记录失败:', error);
    throw error;
  }
}

// 根据代理ID获取思考记录
export async function getThoughtsByAgent(
  db: Database,
  agentId: number, 
  limit: number = 20
): Promise<ThoughtRecord[]> {
  try {
    const agentThoughts = await db
      .select()
      .from(thoughts)
      .where(eq(thoughts.agentId, agentId))
      .orderBy(desc(thoughts.createdAt))
      .limit(limit);

    return agentThoughts.map(dbThoughtToFrontend);
  } catch (error) {
    console.error('获取代理思考记录失败:', error);
    throw error;
  }
}

// 数据库记录转换为前端格式
function dbThoughtToFrontend(dbThought: any): ThoughtRecord {
  return {
    id: dbThought.id.toString(),
    timestamp: dbThought.createdAt.getTime(),
    agentId: dbThought.agentId,
    agentName: dbThought.agentName,
    type: dbThought.type,
    content: dbThought.content,
    metadata: {
      confidence: dbThought.confidence ? dbThought.confidence / 100 : undefined,
      reasoning: dbThought.reasoning || undefined,
      shouldInitiateChat: dbThought.shouldInitiateChat === 1 ? true : undefined,
      emotion: dbThought.emotion || undefined,
      conversationId: dbThought.conversationId || undefined,
    },
  };
}