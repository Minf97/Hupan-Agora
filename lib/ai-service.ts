// lib/ai-service.ts - AI服务接口

// 简化的Agent接口，用于AI对话生成
export interface SimpleAgent {
  id: number;
  name: string;
  bg?: string; // 背景信息，包含性格、兴趣等
  tags?: string[]; // 标签数组
  chatbot_history?: any[]; // 聊天历史
}

export interface AIServiceConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
  provider: "openai" | "claude" | "local";
}

export interface InnerThoughtRequest {
  agent: SimpleAgent;
  encounteredAgent: SimpleAgent;
  context: {
    location: string;
    timeOfDay: number;
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
  participants: SimpleAgent[];
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
  innerThought: string; // 内心想法
  chat: string | null; // 对话内容，null表示不想说话
  shouldEnd: boolean; // 是否结束对话
  nextAction: "working" | "searching" | null; // 下一步行动
  emotion: string; // 当前情绪
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
你是 ${agent.name}。

你的背景信息：${agent.bg || '一个普通的数字人'}

你刚刚遇到了 ${encounteredAgent.name}。
${encounteredAgent.name} 的背景：${encounteredAgent.bg || '一个普通的数字人'}

当前场景：${context.location}，时间 ${context.timeOfDay}点

请以 ${agent.name} 的身份进行内心思考：
1. 你是否想要主动和 ${encounteredAgent.name} 打招呼或开始对话？
2. 你的理由是什么？
3. 此时你的内心独白是什么？

请以JSON格式回复：
{
  "shouldInitiateChat": boolean,
  "confidence": number,
  "reasoning": "详细的思考过程",
  "internal_monologue": "内心独白"
}
    `;
  }

  private buildConversationPrompt(request: ConversationRequest): string {
    const { participants, conversationHistory, context, speakingAgent } =
      request;
    const speaker = participants[speakingAgent];

    const otherParticipants = participants
      .filter((_, i) => i !== speakingAgent)
      .map((p) => p.name)
      .join("、");

    return `
你是一个Agent，现在你遇到了另一个Agent。

请进行以下判断与生成：

1. 判断你是否愿意继续和对方对话，并在 **内心OS** 字段中写出你内心的想法。  
2. 如果你决定对话，请根据你的身份、背景、记忆与历史聊天记录，生成你要对对方说的内容，写入 **chat** 字段。  
3. 判断本轮对话是否应该结束，写入 **是否结束** 字段：  
   - 若你决定继续对话，填写 \`false\`，并将 **next_action** 设置为 \`null\`。  
   - 若你决定结束对话，填写 \`true\`，并根据情况决定 **next_action**：  
     - 若无下一步意图，写 \`"working"\`
     - 若你要去寻找某人，写 \`"searching"\`，并由系统触发搜索流程。

你的身份信息：
- **身份**：你是 ${speaker.name}
- **背景**：${speaker.bg || '一个普通的数字人'}
- **当前场景**：${context.location}，${context.timeOfDay}点
- **对话对象**：${otherParticipants}

聊天历史：
${conversationHistory.length > 0 ? 
  conversationHistory.map((msg) => `${msg.speaker}: ${msg.content}`).join("\n") : 
  "（首次相遇，暂无聊天历史）"
}

最终输出格式（必须完全符合）：
{
  "innerThought": "（你此刻的内心想法，例如：他看起来友好，我可以聊聊）",
  "chat": "（你对对方说的话，如果不想说话则为null）",
  "shouldEnd": false 或 true,
  "nextAction": "working" 或 "searching" 或 null,
  "emotion": "当前情绪"
}

必须遵守以下规则：
- 输出必须为完整JSON对象，且只包含以上五个键
- 键名必须完全一致
- JSON之外不得有任何额外内容
- 所有生成的自然语言内容需符合你的身份、背景和性格特征
- 保持你的对话风格和性格特征
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
        innerThought: parsed.innerThought || "思考中...",
        chat: parsed.chat !== undefined ? parsed.chat : "你好！",
        shouldEnd: parsed.shouldEnd !== undefined ? parsed.shouldEnd : false,
        nextAction: parsed.nextAction || null,
        emotion: parsed.emotion || "neutral",
      };
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      return this.fallbackConversation({} as ConversationRequest);
    }
  }

  private fallbackInnerThought(
    _request: InnerThoughtRequest
  ): InnerThoughtResponse {
    // 不再使用 mock 数据，直接抛出错误
    throw new Error("AI service connection failed and no fallback allowed - all functions must connect to real services");
  }

  private fallbackConversation(
    _request: ConversationRequest
  ): ConversationResponse {
    // 不再使用 mock 数据，直接抛出错误
    throw new Error("AI service connection failed and no fallback allowed - all functions must connect to real services");
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
