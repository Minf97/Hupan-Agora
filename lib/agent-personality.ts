// lib/agent-personality.ts - Agent个性和背景系统 - 纯类型定义
// 注意：此文件现在只包含类型定义，不包含任何硬编码数据

export interface AgentPersonality {
  // 基础信息
  name: string;
  age: number;
  occupation: string;
  background: string;
  
  // 性格特征 (0-1范围)
  traits: {
    extraversion: number;     // 外向性 - 是否主动与人交流
    agreeableness: number;    // 宜人性 - 是否友善温和
    conscientiousness: number; // 尽责性 - 是否认真负责
    neuroticism: number;      // 神经质 - 是否情绪化
    openness: number;         // 开放性 - 是否乐于接受新事物
  };
  
  // 兴趣爱好
  interests: string[];
  
  // 当前情绪状态
  mood: 'happy' | 'neutral' | 'sad' | 'excited' | 'tired' | 'anxious';
  
  // 历史记忆
  memories: AgentMemory[];
  
  // 对话风格
  conversationStyle: {
    formality: number;        // 正式程度 (0=很随意, 1=很正式)
    verbosity: number;        // 话多程度 (0=简短, 1=话很多)
    friendliness: number;     // 友好程度 (0=冷淡, 1=热情)
  };
}

export interface AgentMemory {
  id: string;
  timestamp: number;
  type: 'conversation' | 'event' | 'observation';
  content: string;
  participants?: number[];   // 参与者ID
  importance: number;        // 重要性 (0-1)
  emotional_impact: number;  // 情感影响 (-1到+1)
}

// 根据个性特征计算是否愿意开始对话的概率
export function calculateChatWillingness(
  agent1: AgentPersonality,
  agent2: AgentPersonality,
  context: {
    timeOfDay: number; // 小时
    location: string;
    lastInteraction?: number; // 上次交互时间戳
  }
): number {
  let willingness = 0;
  
  // 基础外向性影响
  willingness += (agent1.traits.extraversion + agent2.traits.extraversion) * 0.3;
  
  // 宜人性影响
  willingness += (agent1.traits.agreeableness + agent2.traits.agreeableness) * 0.2;
  
  // 情绪状态影响
  const moodBonus = {
    'happy': 0.3,
    'excited': 0.4,
    'neutral': 0,
    'tired': -0.2,
    'sad': -0.3,
    'anxious': -0.1
  };
  willingness += (moodBonus[agent1.mood] + moodBonus[agent2.mood]) * 0.5;
  
  // 兴趣重叠度影响
  const commonInterests = agent1.interests.filter(interest => 
    agent2.interests.includes(interest)
  ).length;
  willingness += commonInterests * 0.1;
  
  // 时间因素 (早晨和晚上交流意愿较低)
  if (context.timeOfDay < 8 || context.timeOfDay > 22) {
    willingness -= 0.2;
  }
  
  // 最近交互频率 (避免过于频繁的交互)
  if (context.lastInteraction && Date.now() - context.lastInteraction < 300000) { // 5分钟内
    willingness -= 0.3;
  }
  
  // 确保在0-1范围内
  return Math.max(0, Math.min(1, willingness));
}