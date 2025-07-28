// lib/agent-personality.ts - Agent个性和背景系统

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

// 为缺失的Agent生成默认个性
function createDefaultPersonality(agentId: number): AgentPersonality {
  const names = ['小明', '小红', '小强', '小丽', '小刚', '小美', '小华', '小芳'];
  const occupations = ['学生', '工程师', '老师', '医生', '设计师', '销售', '律师', '记者'];
  const backgrounds = [
    '性格开朗，喜欢结交朋友',
    '内向安静，喜欢独处思考',
    '活泼好动，充满活力',
    '温和友善，乐于助人',
    '严谨认真，做事有条理',
    '创意十足，想象力丰富'
  ];

  const nameIndex = agentId % names.length;
  const occIndex = agentId % occupations.length;
  const bgIndex = agentId % backgrounds.length;

  return {
    name: names[nameIndex],
    age: 20 + (agentId % 20),
    occupation: occupations[occIndex],
    background: backgrounds[bgIndex],
    traits: {
      extraversion: 0.3 + (agentId % 7) * 0.1,
      agreeableness: 0.4 + (agentId % 6) * 0.1,
      conscientiousness: 0.5 + (agentId % 5) * 0.1,
      neuroticism: 0.2 + (agentId % 4) * 0.1,
      openness: 0.6 + (agentId % 4) * 0.1
    },
    interests: ['音乐', '电影', '运动', '读书'].slice(0, 2 + agentId % 3),
    mood: 'neutral',
    memories: [],
    conversationStyle: {
      formality: 0.4 + (agentId % 3) * 0.2,
      verbosity: 0.5 + (agentId % 3) * 0.2,
      friendliness: 0.6 + (agentId % 4) * 0.1
    }
  };
}

// 获取Agent个性（如果不存在则自动创建）
export function getAgentPersonality(agentId: number): AgentPersonality {
  if (!AGENT_PERSONALITIES[agentId]) {
    console.log(`为Agent ${agentId} 创建默认个性`);
    AGENT_PERSONALITIES[agentId] = createDefaultPersonality(agentId);
  }
  return AGENT_PERSONALITIES[agentId];
}

// 预设的Agent个性
export const AGENT_PERSONALITIES: { [key: number]: AgentPersonality } = {
  1: {
    name: 'Mike',
    age: 28,
    occupation: '软件工程师',
    background: '热爱编程，喜欢钻研新技术，性格相对内向但对技术话题很健谈',
    traits: {
      extraversion: 0.3,
      agreeableness: 0.7,
      conscientiousness: 0.8,
      neuroticism: 0.4,
      openness: 0.9
    },
    interests: ['编程', '游戏', '科技', '电影'],
    mood: 'neutral',
    memories: [],
    conversationStyle: {
      formality: 0.6,
      verbosity: 0.7,
      friendliness: 0.6
    }
  },
  2: {
    name: 'Cassin',
    age: 25,
    occupation: '市场营销',
    background: '外向开朗，善于交际，对商业和市场趋势很敏感',
    traits: {
      extraversion: 0.9,
      agreeableness: 0.8,
      conscientiousness: 0.7,
      neuroticism: 0.2,
      openness: 0.8
    },
    interests: ['旅行', '美食', '社交', '运动'],
    mood: 'happy',
    memories: [],
    conversationStyle: {
      formality: 0.4,
      verbosity: 0.8,
      friendliness: 0.9
    }
  },
  3: {
    name: 'Dax',
    age: 32,
    occupation: '设计师',
    background: '艺术感强，追求美学，有些完美主义倾向',
    traits: {
      extraversion: 0.5,
      agreeableness: 0.6,
      conscientiousness: 0.9,
      neuroticism: 0.6,
      openness: 0.95
    },
    interests: ['设计', '艺术', '摄影', '音乐'],
    mood: 'neutral',
    memories: [],
    conversationStyle: {
      formality: 0.7,
      verbosity: 0.6,
      friendliness: 0.5
    }
  },
  4: {
    name: 'Roland',
    age: 32,
    occupation: '设计师',
    background: '艺术感强，追求美学，有些完美主义倾向',
    traits: {
      extraversion: 0.5,
      agreeableness: 0.6,
      conscientiousness: 0.9,
      neuroticism: 0.6,
      openness: 0.95
    },
    interests: ['设计', '艺术', '摄影', '音乐'],
    mood: 'neutral',
    memories: [],
    conversationStyle: {
      formality: 0.7,
      verbosity: 0.6,
      friendliness: 0.5
    }
  },
  5: {
    name: 'Dax',
    age: 32,
    occupation: '设计师',
    background: '艺术感强，追求美学，有些完美主义倾向',
    traits: {
      extraversion: 0.5,
      agreeableness: 0.6,
      conscientiousness: 0.9,
      neuroticism: 0.6,
      openness: 0.95
    },
    interests: ['设计', '艺术', '摄影', '音乐'],
    mood: 'neutral',
    memories: [],
    conversationStyle: {
      formality: 0.7,
      verbosity: 0.6,
      friendliness: 0.5
    }
  }
};

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