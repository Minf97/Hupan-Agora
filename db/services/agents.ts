import { db } from '../index';
import { agents } from '../schema/agents';
import { eq } from 'drizzle-orm';

// Socket服务器需要的Agent接口
export interface SocketAgent {
  id: number;
  name: string;
  x: number;
  y: number;
  color: string;
  status: string;
}

// 获取所有agent（返回Socket格式）
export async function getAllAgents(): Promise<SocketAgent[]> {
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
export async function updateAgentState(agentId: number, updates: {
  x?: number;
  y?: number;
  status?: string;
}) {
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

// 创建新agent（如果需要）
export async function createAgent(agentData: {
  name: string;
  personality: string;
  description?: string;
  backstory?: string;
  goals?: string;
  bg?: string;
  avatarUrl?: string;
  x?: number;
  y?: number;
  color?: string;
  status?: string;
}) {
  try {
    const result = await db
      .insert(agents)
      .values({
        ...agentData,
        x: agentData.x?.toString() || '5',
        y: agentData.y?.toString() || '5',
        color: agentData.color || '#FF5733',
        status: agentData.status || 'idle'
      })
      .returning();
    
    return result[0];
  } catch (error) {
    console.error('Error creating agent:', error);
    throw error;
  }
}

// 获取单个agent（返回Socket格式）
export async function getAgentById(agentId: number): Promise<SocketAgent | null> {
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
      status: agent.status || 'idle'
    };
  } catch (error) {
    console.error('Error fetching agent by ID:', error);
    throw error;
  }
}