// lib/ai-service.ts - AI服务接口

import { AgentPersonality, AgentMemory } from "./agent-personality";

export interface AIServiceConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
  provider: "openai" | "claude" | "local";
}

export interface InnerThoughtRequest {
  agent: AgentPersonality;
  encounteredAgent: AgentPersonality;
  context: {
    location: string;
    timeOfDay: number;
    recentMemories: AgentMemory[];
    lastInteraction?: number;
  };
}

export interface InnerThoughtResponse {
  shouldInitiateChat: boolean;
  confidence: number; // 0-1, 决策的确信度
  reasoning: string; // AI的思考过程
  mood_change?: "happy" | "neutral" | "sad" | "excited" | "tired" | "anxious";
  internal_monologue: string; // 内心独白
}

export interface ConversationRequest {
  participants: AgentPersonality[];
  conversationHistory: ConversationMessage[];
  context: {
    location: string;
    timeOfDay: number;
    topic?: string;
    turn: number; // 对话轮次
  };
  speakingAgent: number; // 当前发言的agent索引
}

export interface ConversationMessage {
  speaker: string;
  content: string;
  timestamp: number;
  emotion?: string;
}

export interface ConversationResponse {
  message: string;
  emotion: string;
  shouldContinue: boolean; // 是否应该继续对话
  topic_shift?: string; // 话题转换
  memories_to_store: AgentMemory[]; // 需要存储的记忆
}

class AIService {
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = config;
  }

  async generateInnerThought(
    request: InnerThoughtRequest
  ): Promise<InnerThoughtResponse> {
    const prompt = this.buildInnerThoughtPrompt(request);

    try {
      const response = await this.callAI(prompt, "inner-thought");
      return this.parseInnerThoughtResponse(response);
    } catch (error) {
      console.error("AI inner thought generation failed:", error);
      // 降级处理
      return this.fallbackInnerThought(request);
    }
  }

  async generateConversationResponse(
    request: ConversationRequest
  ): Promise<ConversationResponse> {
    const prompt = this.buildConversationPrompt(request);

    try {
      const response = await this.callAI(prompt, "conversation");
      return this.parseConversationResponse(response);
    } catch (error) {
      console.error("AI conversation generation failed:", error);
      // 降级处理
      return this.fallbackConversation(request);
    }
  }

  private buildInnerThoughtPrompt(request: InnerThoughtRequest): string {
    const { agent, encounteredAgent, context } = request;

    return `
你是 ${agent.name}，一个${agent.age}岁的${agent.occupation}。

你的背景：${agent.background}

你的性格特征：
- 外向性: ${agent.traits.extraversion}/1.0
- 宜人性: ${agent.traits.agreeableness}/1.0  
- 尽责性: ${agent.traits.conscientiousness}/1.0
- 神经质: ${agent.traits.neuroticism}/1.0
- 开放性: ${agent.traits.openness}/1.0

你的兴趣爱好：${agent.interests.join(", ")}
当前情绪：${agent.mood}
当前时间：${context.timeOfDay}点

你刚刚遇到了 ${encounteredAgent.name}（${encounteredAgent.age}岁，${
      encounteredAgent.occupation
    }）。
${encounteredAgent.name} 的背景：${encounteredAgent.background}
${encounteredAgent.name} 的兴趣：${encounteredAgent.interests.join(", ")}

最近的记忆：
${context.recentMemories
  .slice(0, 3)
  .map((m) => `- ${m.content}`)
  .join("\n")}

请以 ${agent.name} 的身份进行内心思考：
1. 你是否想要主动和 ${encounteredAgent.name} 打招呼或开始对话？
2. 你的理由是什么？
3. 此时你的内心独白是什么？
4. 这次相遇是否会影响你的心情？

请以JSON格式回复：
{
  "shouldInitiateChat": boolean,
  "confidence": number,
  "reasoning": "详细的思考过程",
  "internal_monologue": "内心独白",
  "mood_change": "新的情绪状态（如果有变化）"
}
    `;
  }

  private buildConversationPrompt(request: ConversationRequest): string {
    const { participants, conversationHistory, context, speakingAgent } =
      request;
    const speaker = participants[speakingAgent];

    return `
你是 ${speaker.name}，正在和${participants
      .filter((_, i) => i !== speakingAgent)
      .map((p) => p.name)
      .join("、")}进行对话。

你的背景：${speaker.background}
你的性格：外向性${speaker.traits.extraversion}/1.0, 宜人性${
      speaker.traits.agreeableness
    }/1.0
你的对话风格：正式程度${speaker.conversationStyle.formality}/1.0, 话多程度${
      speaker.conversationStyle.verbosity
    }/1.0, 友好程度${speaker.conversationStyle.friendliness}/1.0

对话场景：${context.location}，${context.timeOfDay}点

对话历史：
${conversationHistory.map((msg) => `${msg.speaker}: ${msg.content}`).join("\n")}

请以 ${speaker.name} 的身份回复，保持你的性格特征和对话风格。

回复JSON格式：
{
  "message": "你的回复内容",
  "emotion": "当前情绪",
  "shouldContinue": boolean,
  "topic_shift": "话题转换（如果有）",
  "memories_to_store": [
    {
      "type": "conversation",
      "content": "值得记住的对话内容",
      "importance": 0.7,
      "emotional_impact": 0.2
    }
  ]
}
    `;
  }

  private async callAI(prompt: string, type: string): Promise<string> {
    // 这里根据配置的provider调用不同的AI服务
    switch (this.config.provider) {
      case "openai":
        return await this.callOpenAI(prompt);
      case "claude":
        return await this.callClaude(prompt);
      case "local":
        return await this.callLocalModel(prompt);
      default:
        throw new Error(`Unsupported AI provider: ${this.config.provider}`);
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const baseURL = this.config.baseURL || "https://api.openai.com";
    const apiUrl = `${baseURL}/v1/chat/completions`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: "system",
            content: "你是一个智能助手，帮助模拟数字人的内心想法和对话。",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("API Error:", response.status, errorData);
      throw new Error(`API Error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Invalid API response:", data);
      throw new Error("Invalid API response format");
    }

    return data.choices[0].message.content;
  }

  private async callClaude(_prompt: string): Promise<string> {
    // Claude API 调用实现
    throw new Error("Claude API not implemented yet");
  }

  private async callLocalModel(_prompt: string): Promise<string> {
    // 本地模型调用实现
    throw new Error("Local model not implemented yet");
  }

  private parseInnerThoughtResponse(response: string): InnerThoughtResponse {
    console.log(response, "response");

    // 过滤掉 ```json 或 ``` 这两个字符串
    let cleanResponse = response
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "")
      .trim();

    try {
      const parsed = JSON.parse(cleanResponse);
      return {
        shouldInitiateChat: parsed.shouldInitiateChat || false,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || "",
        internal_monologue: parsed.internal_monologue || "",
        mood_change: parsed.mood_change,
      };
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      return this.fallbackInnerThought({} as InnerThoughtRequest);
    }
  }

  private parseConversationResponse(response: string): ConversationResponse {
    // 删除```json 和```
    let cleanResponse = response
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "")
      .trim();
    try {
      const parsed = JSON.parse(cleanResponse);
      return {
        message: parsed.message || "你好！",
        emotion: parsed.emotion || "neutral",
        shouldContinue: parsed.shouldContinue !== false,
        topic_shift: parsed.topic_shift,
        memories_to_store: parsed.memories_to_store || [],
      };
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      return this.fallbackConversation({} as ConversationRequest);
    }
  }

  private fallbackInnerThought(
    _request: InnerThoughtRequest
  ): InnerThoughtResponse {
    // 简单的降级逻辑
    return {
      shouldInitiateChat: Math.random() > 0.5,
      confidence: 0.3,
      reasoning: "无法连接AI服务，使用随机决策",
      internal_monologue: "嗯，要不要打个招呼呢？",
    };
  }

  private fallbackConversation(
    _request: ConversationRequest
  ): ConversationResponse {
    const responses = [
      "你好！",
      "最近怎么样？",
      "今天天气不错呢",
      "很高兴见到你",
    ];
    return {
      message: responses[Math.floor(Math.random() * responses.length)],
      emotion: "neutral",
      shouldContinue: true,
      memories_to_store: [],
    };
  }
}

// 单例模式
let aiServiceInstance: AIService | null = null;

export function getAIService(config?: AIServiceConfig): AIService {
  if (!aiServiceInstance && config) {
    aiServiceInstance = new AIService(config);
  }
  if (!aiServiceInstance) {
    throw new Error("AI service not initialized. Please provide config first.");
  }
  return aiServiceInstance;
}

export { AIService };
