// lib/agent-database.ts - 真正的数据库Agent个性获取函数
import { AgentPersonality, AgentMemory } from './agent-personality';
import useAgentCacheStore from './agent-cache-store';

// API 基础URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// 从数据库获取Agent个性信息
export async function fetchAgentPersonalityFromDB(agentId: number): Promise<AgentPersonality> {
  try {
    // 1. 使用缓存获取基本Agent信息
    const { getAgent } = useAgentCacheStore.getState();
    const agentData = await getAgent(agentId);
    console.log(`📦 从缓存/数据库获取Agent ${agentId} 基本信息:`, agentData);

    // 2. 获取Agent的思考记录作为记忆
    const thoughtsResponse = await fetch(`${API_BASE}/api/agents/${agentId}/thoughts`);
    let memories: AgentMemory[] = [];
    
    if (thoughtsResponse.ok) {
      const thoughtsData = await thoughtsResponse.json();
      memories = thoughtsData.map((thought: any) => ({
        id: thought.id.toString(),
        timestamp: new Date(thought.createdAt).getTime(),
        type: thought.type === 'conversation' ? 'conversation' : 'observation',
        content: thought.content,
        participants: thought.type === 'conversation' ? [agentId] : undefined,
        importance: thought.confidence ? thought.confidence / 100 : 0.5,
        emotional_impact: thought.emotion ? getEmotionalImpact(thought.emotion) : 0
      }));
      console.log(`🧠 从数据库获取Agent ${agentId} 记忆 ${memories.length} 条`);
    }

    // 3. 从数据库数据构建个性对象
    const personality: AgentPersonality = {
      name: agentData.name,
      age: calculateAgeBasedOnId(agentId), // 基于ID计算年龄
      occupation: extractOccupationFromBackground(agentData.bg || ''),
      background: agentData.bg || '一个友好的AI助手',
      
      // 基于tags和历史数据计算性格特征
      traits: calculateTraitsFromData(agentData, memories),
      
      // 使用tags作为兴趣
      interests: Array.isArray(agentData.tags) ? agentData.tags : [],
      
      // 基于最近的思考记录推断情绪
      mood: inferMoodFromRecentThoughts(memories),
      
      memories: memories,
      
      // 基于对话历史推断对话风格
      conversationStyle: calculateConversationStyleFromHistory(agentData.chatbot_history || [], memories)
    };

    console.log(`✅ 成功构建Agent ${agentId} 个性档案:`, personality);
    return personality;

  } catch (error) {
    console.error(`❌ 从数据库获取Agent ${agentId} 个性失败:`, error);
    return null as any;
  }
}

// 计算基于数据的性格特征
function calculateTraitsFromData(agentData: any, memories: AgentMemory[]) {
  const conversationCount = memories.filter(m => m.type === 'conversation').length;
  const totalMemories = memories.length;
  
  // 基于对话数量推断外向性
  const extraversion = Math.min(0.9, 0.3 + (conversationCount / Math.max(totalMemories, 1)) * 0.6);
  
  // 基于背景文本长度和标签数量推断其他特征
  const bgLength = (agentData.bg || '').length;
  const tagCount = Array.isArray(agentData.tags) ? agentData.tags.length : 0;
  
  return {
    extraversion,
    agreeableness: 0.5 + (tagCount > 2 ? 0.2 : 0) + (conversationCount > 0 ? 0.1 : 0),
    conscientiousness: 0.4 + (bgLength > 50 ? 0.3 : 0.1),
    neuroticism: Math.max(0.1, 0.5 - (conversationCount / Math.max(totalMemories, 1)) * 0.3),
    openness: Math.min(0.9, 0.5 + tagCount * 0.1)
  };
}

// 从情绪字符串计算情感影响
function getEmotionalImpact(emotion: string): number {
  const emotionMap: { [key: string]: number } = {
    'happy': 0.7,
    'excited': 0.8,
    'joyful': 0.6,
    'satisfied': 0.4,
    'neutral': 0,
    'calm': 0.2,
    'tired': -0.2,
    'sad': -0.6,
    'angry': -0.7,
    'frustrated': -0.5,
    'anxious': -0.4,
    'worried': -0.3
  };
  
  return emotionMap[emotion.toLowerCase()] || 0;
}

// 从最近的思考记录推断当前情绪
function inferMoodFromRecentThoughts(memories: AgentMemory[]): AgentPersonality['mood'] {
  if (memories.length === 0) return 'neutral';
  
  // 获取最近5条记录
  const recentMemories = memories
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);
  
  const avgEmotionalImpact = recentMemories.reduce((sum, memory) => 
    sum + memory.emotional_impact, 0) / recentMemories.length;
  
  if (avgEmotionalImpact > 0.5) return 'happy';
  if (avgEmotionalImpact > 0.2) return 'excited';
  if (avgEmotionalImpact < -0.4) return 'sad';
  if (avgEmotionalImpact < -0.2) return 'tired';
  if (avgEmotionalImpact < -0.1) return 'anxious';
  
  return 'neutral';
}

// 从背景文本提取职业信息
function extractOccupationFromBackground(background: string): string {
  const occupationKeywords = {
    '工程师': ['工程师', '程序员', '开发', '编程', '技术'],
    '设计师': ['设计', '美工', '创意', '艺术'],
    '老师': ['教师', '老师', '教育', '培训'],
    '医生': ['医生', '医疗', '护士', '健康'],
    '销售': ['销售', '市场', '营销', '客户'],
    '学生': ['学生', '学习', '学校', '大学']
  };
  
  for (const [occupation, keywords] of Object.entries(occupationKeywords)) {
    if (keywords.some(keyword => background.includes(keyword))) {
      return occupation;
    }
  }
  
  return '助手'; // 默认职业
}

// 计算对话风格
function calculateConversationStyleFromHistory(chatHistory: any[], memories: AgentMemory[]) {
  const conversationMemories = memories.filter(m => m.type === 'conversation');
  const totalConversations = conversationMemories.length;
  
  // 基于对话数量和历史计算风格
  const formality = totalConversations > 10 ? 0.6 : 0.4;
  const verbosity = Math.min(0.9, 0.3 + totalConversations * 0.02);
  const friendliness = conversationMemories.length > 0 ? 
    Math.min(0.9, 0.5 + (conversationMemories.filter(m => m.emotional_impact > 0).length / totalConversations) * 0.4) : 
    0.5;
  
  return { formality, verbosity, friendliness };
}

// 基于ID计算年龄
function calculateAgeBasedOnId(agentId: number): number {
  return 20 + (agentId % 30); // 20-49岁范围
}

// 缓存机制
const personalityCache = new Map<number, { personality: AgentPersonality; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 带缓存的获取函数
export async function getAgentPersonalityFromDB(agentId: number): Promise<AgentPersonality> {
  // 检查缓存
  const cached = personalityCache.get(agentId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`📋 使用Agent ${agentId} 的缓存个性数据`);
    return cached.personality;
  }
  
  // 从数据库获取
  const personality = await fetchAgentPersonalityFromDB(agentId);
  
  // 更新缓存
  personalityCache.set(agentId, {
    personality,
    timestamp: Date.now()
  });
  
  return personality;
}