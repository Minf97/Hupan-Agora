// workers/src/db/services/agents.ts - Agent database services for Cloudflare Workers
import { eq } from 'drizzle-orm';
import { agents } from '../schema';
import type { Database } from '../index';

// Socket服务器需要的Agent接口
export interface SocketAgent {
  id: number;
  name: string;
  x: number;
  y: number;
  color: string;
  status: string;
  currentTask?: string | null;
  avatar?: string | null;
}

// 获取所有agent（返回Socket格式）
export async function getAllAgents(db: Database): Promise<SocketAgent[]> {
  try {
    const result = await db.select().from(agents);
    return result.map(agent => ({
      id: agent.id,
      name: agent.name,
      x: parseFloat(agent.x || '5'),
      y: parseFloat(agent.y || '5'),
      color: agent.color || '#FF5733',
      status: agent.status || 'idle',
      currentTask: null, // Reset current task on server start
      avatar: agent.avatarUrl || null
    }));
  } catch (error) {
    console.error('Error fetching agents:', error);
    throw error;
  }
}

// 更新agent位置和状态
export async function updateAgentState(
  db: Database,
  agentId: number, 
  updates: {
    x?: number;
    y?: number;
    status?: string;
    currentTask?: string | null;
  }
) {
  try {
    const updateData: any = {};
    
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

// 获取单个agent（返回Socket格式）
export async function getAgentById(db: Database, agentId: number): Promise<SocketAgent | null> {
  try {
    const result = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);
    
    if (result.length === 0) return null;
    
    const agent = result[0];
    return {
      id: agent.id,
      name: agent.name,
      x: parseFloat(agent.x || '5'),
      y: parseFloat(agent.y || '5'),
      color: agent.color || '#FF5733',
      status: agent.status || 'idle',
      currentTask: null
    };
  } catch (error) {
    console.error('Error fetching agent by ID:', error);
    throw error;
  }
}