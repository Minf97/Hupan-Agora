// lib/memory-service.ts - 记忆管理服务

import { db } from '@/db';
import { memories, type Memory, type InsertMemory } from '@/db/schema/memories';
import { desc, eq, sql, and, gt } from 'drizzle-orm';
import { generateEmbedding } from '@/lib/embeddings';
import OpenAI from 'openai';

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASEURL,
});

// Memory 接口定义
export interface MemoryRecord {
  id: number;
  agentId: number;
  content: string;
  type: 'observation' | 'thought' | 'conversation' | 'reflection' | 'goal' | 'emotion';
  importance: number;
  similarity?: number;
  createdAt: Date;
  updatedAt: Date;
}

// 记忆类型的重要性权重
const MEMORY_TYPE_WEIGHTS = {
  reflection: 5,      // 反思最重要
  goal: 4,           // 目标次之
  emotion: 3,        // 情绪
  conversation: 2,   // 对话
  thought: 2,        // 想法
  observation: 1,    // 观察最基础
};

// 删除重复的 generateEmbedding 函数，使用 @/lib/embeddings 中的

// 添加记忆
export async function addMemory(
  agentId: number,
  content: string,
  type: MemoryRecord['type'],
  importance?: number
): Promise<MemoryRecord> {
  try {
    // 生成嵌入向量
    const embedding = await generateEmbedding(content);
    
    // 计算重要性分数（如果未提供）
    const finalImportance = importance ?? MEMORY_TYPE_WEIGHTS[type] ?? 1;
    
    const newMemory: InsertMemory = {
      agentId,
      content,
      type,
      importance: finalImportance,
      embedding: embedding, // 直接存储向量数组
    };
    
    const [insertedMemory] = await db.insert(memories).values(newMemory).returning();
    
    return dbMemoryToFrontend(insertedMemory);
  } catch (error) {
    console.error('添加记忆失败:', error);
    throw error;
  }
}

// 检索相似记忆
export async function retrieveSimilarMemories(
  content: string,
  agentId: number,
  limit: number = 5,
  minSimilarity: number = 0.7
): Promise<MemoryRecord[]> {
  try {
    // 生成查询文本的嵌入向量
    const queryEmbedding = await generateEmbedding(content);
    
    // 使用余弦相似度检索相似记忆
    const similarMemories = await db
      .select({
        id: memories.id,
        agentId: memories.agentId,
        content: memories.content,
        type: memories.type,
        importance: memories.importance,
        createdAt: memories.createdAt,
        updatedAt: memories.updatedAt,
        similarity: sql<number>`1 - (${memories.embedding} <=> ${queryEmbedding}::vector)`,
      })
      .from(memories)
      .where(
        and(
          eq(memories.agentId, agentId),
          gt(sql`1 - (${memories.embedding} <=> ${queryEmbedding}::vector)`, minSimilarity)
        )
      )
      .orderBy(sql`1 - (${memories.embedding} <=> ${queryEmbedding}::vector) DESC`)
      .limit(limit);
    
    return similarMemories.map(memory => ({
      ...memory,
      type: memory.type as MemoryRecord['type'],
      similarity: memory.similarity,
    }));
  } catch (error) {
    console.error('检索相似记忆失败:', error);
    throw error;
  }
}

// 获取代理的最近记忆
export async function getRecentMemories(
  agentId: number,
  limit: number = 10
): Promise<MemoryRecord[]> {
  try {
    const recentMemories = await db
      .select()
      .from(memories)
      .where(eq(memories.agentId, agentId))
      .orderBy(desc(memories.createdAt))
      .limit(limit);
    
    return recentMemories.map(dbMemoryToFrontend);
  } catch (error) {
    console.error('获取最近记忆失败:', error);
    throw error;
  }
}

// 获取重要记忆
export async function getImportantMemories(
  agentId: number,
  minImportance: number = 3,
  limit: number = 10
): Promise<MemoryRecord[]> {
  try {
    const importantMemories = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.agentId, agentId),
          gt(memories.importance, minImportance)
        )
      )
      .orderBy(desc(memories.importance), desc(memories.createdAt))
      .limit(limit);
    
    return importantMemories.map(dbMemoryToFrontend);
  } catch (error) {
    console.error('获取重要记忆失败:', error);
    throw error;
  }
}

// 根据类型获取记忆
export async function getMemoriesByType(
  agentId: number,
  type: MemoryRecord['type'],
  limit: number = 10
): Promise<MemoryRecord[]> {
  try {
    const typeMemories = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.agentId, agentId),
          eq(memories.type, type)
        )
      )
      .orderBy(desc(memories.createdAt))
      .limit(limit);
    
    return typeMemories.map(dbMemoryToFrontend);
  } catch (error) {
    console.error('获取类型记忆失败:', error);
    throw error;
  }
}

// 生成反思记忆
export async function generateReflection(
  agentId: number,
  recentThoughts: string[]
): Promise<MemoryRecord | null> {
  try {
    if (recentThoughts.length === 0) return null;
    
    // 构造反思提示
    const reflectionPrompt = `
根据以下最近的思考和经历，生成一个深刻的反思：

最近的思考：
${recentThoughts.map((thought, i) => `${i + 1}. ${thought}`).join('\n')}

请生成一个简洁但深刻的反思，总结这些经历的核心洞察或学习。反思应该：
1. 概括关键模式或主题
2. 提取可操作的洞察
3. 不超过100字

反思内容：`;
    
    const response = await openai.chat.completions.create({
      model: process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一个善于反思和总结的AI助手，能够从经历中提取深刻洞察。',
        },
        {
          role: 'user',
          content: reflectionPrompt,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });
    
    const reflectionContent = response.choices[0].message.content?.trim();
    
    if (reflectionContent) {
      return await addMemory(agentId, reflectionContent, 'reflection', 5);
    }
    
    return null;
  } catch (error) {
    console.error('生成反思失败:', error);
    return null;
  }
}

// 清空代理记忆
export async function clearAgentMemories(agentId: number): Promise<void> {
  try {
    await db.delete(memories).where(eq(memories.agentId, agentId));
  } catch (error) {
    console.error('清空代理记忆失败:', error);
    throw error;
  }
}

// 数据库记录转换为前端格式
function dbMemoryToFrontend(dbMemory: any): MemoryRecord {
  return {
    id: dbMemory.id,
    agentId: dbMemory.agentId,
    content: dbMemory.content,
    type: dbMemory.type,
    importance: dbMemory.importance,
    createdAt: dbMemory.createdAt,
    updatedAt: dbMemory.updatedAt,
  };
}