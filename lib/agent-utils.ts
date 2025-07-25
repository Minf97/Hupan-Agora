// lib/agent-utils.ts
import { AgentState } from "@/lib/map-config";
import { AgentPersonality, calculateChatWillingness, getAgentPersonality } from './agent-personality';
import { getAIService, InnerThoughtRequest, InnerThoughtResponse } from './ai-service';

// 计算两点间距离 - 增强版本
export const calculateDistance = (
  pos1: { x: number; y: number },
  pos2: { x: number; y: number }
): number => {
  // 输入验证
  if (!pos1 || !pos2) {
    console.warn('calculateDistance: 缺少位置参数');
    return Infinity;
  }

  if (
    typeof pos1.x !== 'number' || typeof pos1.y !== 'number' ||
    typeof pos2.x !== 'number' || typeof pos2.y !== 'number' ||
    isNaN(pos1.x) || isNaN(pos1.y) || isNaN(pos2.x) || isNaN(pos2.y)
  ) {
    console.warn('calculateDistance: 位置坐标包含非数字值');
    return Infinity;
  }

  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// 相遇距离阈值常量
export const MEETING_DISTANCE_THRESHOLD = 30;

// 调试辅助：获取agent状态摘要
export const getAgentStatusSummary = (agent: AgentState): string => {
  if (!agent) return 'null';
  return `Agent ${agent.id}(${agent.name || 'Unknown'}) 状态:${agent.status} 位置:(${agent.position?.x || 'N/A'}, ${agent.position?.y || 'N/A'})`;
};

// 检查两个agent是否相遇（距离小于阈值）- 增强版本
export const checkAgentsMeeting = (agent1: AgentState, agent2: AgentState, threshold: number = MEETING_DISTANCE_THRESHOLD): boolean => {
  // 输入验证
  if (!agent1 || !agent2 || !agent1.position || !agent2.position) {
    console.warn('checkAgentsMeeting: 无效的agent或位置数据');
    return false;
  }

  // 检查位置数据的有效性
  if (
    typeof agent1.position.x !== 'number' || typeof agent1.position.y !== 'number' ||
    typeof agent2.position.x !== 'number' || typeof agent2.position.y !== 'number' ||
    isNaN(agent1.position.x) || isNaN(agent1.position.y) ||
    isNaN(agent2.position.x) || isNaN(agent2.position.y)
  ) {
    console.warn('checkAgentsMeeting: 位置坐标包含非数字值');
    return false;
  }

  const distance = calculateDistance(agent1.position, agent2.position);
  return distance < threshold;
};

// 检查agent相遇 - 优化版本
export const checkForMeetings = (currentAgents: AgentState[]) => {
  const meetings: { agent1: number; agent2: number }[] = [];

  // 边界检查：确保agents数组有效
  if (!currentAgents || currentAgents.length < 2) {
    return meetings;
  }

  for (let i = 0; i < currentAgents.length; i++) {
    for (let j = i + 1; j < currentAgents.length; j++) {
      const agent1 = currentAgents[i];
      const agent2 = currentAgents[j];

      // 增强的状态检查：确保两个agent都存在且有有效位置
      if (
        !agent1 || !agent2 || 
        !agent1.position || !agent2.position ||
        typeof agent1.position.x !== 'number' || 
        typeof agent1.position.y !== 'number' ||
        typeof agent2.position.x !== 'number' || 
        typeof agent2.position.y !== 'number'
      ) {
        continue;
      }

      // 如果两个agent都是空闲状态且相遇了
      if (
        agent1.status === "idle" &&
        agent2.status === "idle" &&
        checkAgentsMeeting(agent1, agent2)
      ) {
        meetings.push({ agent1: agent1.id, agent2: agent2.id });
        
        // 添加调试日志
        console.log(`🔍 检测到相遇: Agent ${agent1.id}(${agent1.name}) 在 (${agent1.position.x}, ${agent1.position.y}) 与 Agent ${agent2.id}(${agent2.name}) 在 (${agent2.position.x}, ${agent2.position.y}) 相遇，距离: ${Math.round(calculateDistance(agent1.position, agent2.position))}px`);
      }
    }
  }

  return meetings;
};


// 相遇后的内心思考决策 (内心OS / 反思)
export async function processAgentEncounter(
  agent1Id: number,
  agent2Id: number,
  context: {
    location: string;
    timeOfDay: number;
    townTime: { hour: number; minute: number };
  }
): Promise<{
  agent1WantsToChat: boolean;
  agent2WantsToChat: boolean;
  agent1Thoughts: InnerThoughtResponse;
  agent2Thoughts: InnerThoughtResponse;
}> {
  const agent1Personality = getAgentPersonality(agent1Id);
  const agent2Personality = getAgentPersonality(agent2Id);

  try {
    const aiService = getAIService();
    
    // 并行处理两个agent的内心思考
    const [agent1Thoughts, agent2Thoughts] = await Promise.all([
      aiService.generateInnerThought({
        agent: agent1Personality,
        encounteredAgent: agent2Personality,
        context: {
          location: context.location,
          timeOfDay: context.townTime.hour,
          recentMemories: agent1Personality.memories.slice(-5)
        }
      }),
      aiService.generateInnerThought({
        agent: agent2Personality,
        encounteredAgent: agent1Personality,
        context: {
          location: context.location,
          timeOfDay: context.townTime.hour,
          recentMemories: agent2Personality.memories.slice(-5)
        }
      })
    ]);

    console.log(`${agent1Personality.name} 内心想法:`, agent1Thoughts.internal_monologue);
    console.log(`${agent2Personality.name} 内心想法:`, agent2Thoughts.internal_monologue);

    return {
      agent1WantsToChat: agent1Thoughts.shouldInitiateChat,
      agent2WantsToChat: agent2Thoughts.shouldInitiateChat,
      agent1Thoughts,
      agent2Thoughts
    };
  } catch (error) {
    console.error('AI service error during encounter processing:', error);
    
    // 降级处理：使用基础的概率计算
    const willingness = calculateChatWillingness(
      agent1Personality,
      agent2Personality,
      {
        timeOfDay: context.townTime.hour,
        location: context.location
      }
    );

    const shouldChat = willingness > 0.5;
    
    return {
      agent1WantsToChat: shouldChat,
      agent2WantsToChat: shouldChat,
      agent1Thoughts: createFallbackThoughts(agent1Id, shouldChat),
      agent2Thoughts: createFallbackThoughts(agent2Id, shouldChat)
    };
  }
}

// 创建降级的思考结果
function createFallbackThoughts(_agentId: number, shouldChat: boolean = false): InnerThoughtResponse {
  return {
    shouldInitiateChat: shouldChat,
    confidence: 0.3,
    reasoning: 'AI服务不可用，使用基础逻辑判断',
    internal_monologue: shouldChat 
      ? `嗯，要不要和对方打个招呼呢？` 
      : `现在不太想聊天，先观察一下吧。`
  };
}

// 内心OS (反思) - 保留原接口兼容性
export async function innerOS(agentId: number, encounteredAgentId?: number): Promise<string> {
  if (!encounteredAgentId) {
    return `Agent ${agentId} 的内心OS - 没有遇到其他人`;
  }

  try {
    const result = await processAgentEncounter(agentId, encounteredAgentId, {
      location: '街道',
      timeOfDay: new Date().getHours(),
      townTime: { hour: new Date().getHours(), minute: new Date().getMinutes() }
    });
    
    return result.agent1Thoughts.internal_monologue;
  } catch (error) {
    console.error('innerOS error:', error);
    return `Agent ${agentId} 的内心OS - 思考中...`;
  }
}

// 判断是否应该开始对话
export async function shouldStartConversation(
  agent1Id: number,
  agent2Id: number,
  context: {
    location: string;
    timeOfDay: number;
    townTime: { hour: number; minute: number };
  }
): Promise<boolean> {
  const encounterResult = await processAgentEncounter(agent1Id, agent2Id, context);
  
  // 只有双方都有意愿（或至少一方非常主动）才开始对话
  const bothWilling = encounterResult.agent1WantsToChat && encounterResult.agent2WantsToChat;
  const oneVeryWilling = 
    (encounterResult.agent1WantsToChat && encounterResult.agent1Thoughts.confidence > 0.8) ||
    (encounterResult.agent2WantsToChat && encounterResult.agent2Thoughts.confidence > 0.8);
  
  return bothWilling || oneVeryWilling;
}

// 对话，开启聊天 - 保留原接口兼容性
export async function startConversation(agent1: number, agent2: number): Promise<string> {
  const shouldStart = await shouldStartConversation(agent1, agent2, {
    location: '街道',
    timeOfDay: new Date().getHours(),
    townTime: { hour: new Date().getHours(), minute: new Date().getMinutes() }
  });
  
  if (shouldStart) {
    return `Agent ${agent1} 和 Agent ${agent2} 开始对话`;
  } else {
    return `Agent ${agent1} 和 Agent ${agent2} 互相看了看，但没有开始对话`;
  }
}