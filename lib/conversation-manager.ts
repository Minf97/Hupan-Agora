// lib/conversation-manager.ts - 对话状态管理系统

import { AGENT_PERSONALITIES, AgentMemory, getAgentPersonality } from './agent-personality';
import { getAIService, ConversationMessage, ConversationResponse } from './ai-service';

export interface ActiveConversation {
  id: string;
  participants: number[]; // Agent IDs
  startTime: number;
  lastActivity: number;
  location: string;
  messages: ConversationMessage[];
  currentTurn: number;
  status: 'active' | 'paused' | 'ended';
  topic?: string;
  endReason?: 'natural' | 'interrupted' | 'timeout';
}

export interface ConversationStartOptions {
  participants: number[];
  location: string;
  initiator?: number; // 发起对话的agent
  initialTopic?: string;
}

class ConversationManager {
  private activeConversations: Map<string, ActiveConversation> = new Map();
  private conversationTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  // 对话持续时间限制（毫秒）
  private readonly MAX_CONVERSATION_DURATION = 5 * 60 * 1000; // 5分钟
  private readonly INACTIVITY_TIMEOUT = 30 * 1000; // 30秒无活动就结束

  async startConversation(options: ConversationStartOptions): Promise<ActiveConversation> {
    const conversationId = this.generateConversationId();
    const now = Date.now();
    
    const conversation: ActiveConversation = {
      id: conversationId,
      participants: options.participants,
      startTime: now,
      lastActivity: now,
      location: options.location,
      messages: [],
      currentTurn: 0,
      status: 'active',
      topic: options.initialTopic,
    };

    // 生成开场白
    if (options.initiator) {
      const openingMessage = await this.generateOpeningMessage(
        options.initiator,
        options.participants.filter(id => id !== options.initiator),
        options.location
      );
      
      if (openingMessage) {
        conversation.messages.push({
          speaker: AGENT_PERSONALITIES[options.initiator]?.name || `Agent ${options.initiator}`,
          content: openingMessage.message,
          timestamp: now,
          emotion: openingMessage.emotion,
        });
        
        // 存储记忆
        this.storeConversationMemories(options.initiator, openingMessage.memories_to_store);
      }
    }

    this.activeConversations.set(conversationId, conversation);
    this.setupConversationTimeout(conversationId);
    
    console.log(`对话开始: ${conversationId}，参与者:`, options.participants);
    return conversation;
  }

  async continueConversation(conversationId: string): Promise<ConversationMessage | null> {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation || conversation.status !== 'active') {
      return null;
    }

    // 确定下一个发言者
    const nextSpeaker = this.getNextSpeaker(conversation);
    if (nextSpeaker === -1) {
      await this.endConversation(conversationId, 'natural');
      return null;
    }

    try {
      const response = await this.generateConversationResponse(conversation, nextSpeaker);
      
      const message: ConversationMessage = {
        speaker: AGENT_PERSONALITIES[nextSpeaker]?.name || `Agent ${nextSpeaker}`,
        content: response.message,
        timestamp: Date.now(),
        emotion: response.emotion,
      };

      // 更新对话状态
      conversation.messages.push(message);
      conversation.currentTurn++;
      conversation.lastActivity = Date.now();
      
      if (response.topic_shift) {
        conversation.topic = response.topic_shift;
      }

      // 存储记忆
      this.storeConversationMemories(nextSpeaker, response.memories_to_store);

      // 检查是否应该结束对话
      if (!response.shouldContinue || this.shouldEndConversation(conversation)) {
        await this.endConversation(conversationId, 'natural');
      } else {
        // 重新设置超时
        this.setupConversationTimeout(conversationId);
      }

      return message;
    } catch (error) {
      console.error('生成对话回复失败:', error);
      await this.endConversation(conversationId, 'interrupted');
      return null;
    }
  }

  async endConversation(conversationId: string, reason: 'natural' | 'interrupted' | 'timeout'): Promise<void> {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return;

    conversation.status = 'ended';
    conversation.endReason = reason;

    // 清除超时定时器
    const timeout = this.conversationTimeouts.get(conversationId);
    if (timeout) {
      clearTimeout(timeout);
      this.conversationTimeouts.delete(conversationId);
    }

    // 为每个参与者生成对话总结记忆并存储到数据库
    await this.createConversationMemories(conversation);

    console.log(`对话结束: ${conversationId}，原因: ${reason}`);
    
    // 可以选择从活跃对话中移除，或者保留一段时间用于查询
    // this.activeConversations.delete(conversationId);
  }

  getActiveConversations(): ActiveConversation[] {
    return Array.from(this.activeConversations.values()).filter(c => c.status === 'active');
  }

  getConversation(conversationId: string): ActiveConversation | undefined {
    return this.activeConversations.get(conversationId);
  }

  isAgentInConversation(agentId: number): boolean {
    return Array.from(this.activeConversations.values()).some(
      conv => conv.status === 'active' && conv.participants.includes(agentId)
    );
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private async generateOpeningMessage(
    initiatorId: number,
    otherParticipants: number[],
    location: string
  ): Promise<ConversationResponse | null> {
    try {
      const aiService = getAIService();
      const participants = [initiatorId, ...otherParticipants].map(id => getAgentPersonality(id));
      
      if (participants.length === 0) return null;

      return await aiService.generateConversationResponse({
        participants,
        conversationHistory: [],
        context: {
          location,
          timeOfDay: new Date().getHours(),
          turn: 0
        },
        speakingAgent: 0 // initiator是第一个
      });
    } catch (error) {
      console.error('生成开场白失败:', error);
      return {
        message: '你好！',
        emotion: 'neutral',
        shouldContinue: true,
        memories_to_store: []
      };
    }
  }

  private async generateConversationResponse(
    conversation: ActiveConversation,
    speakerId: number
  ): Promise<ConversationResponse> {
    const aiService = getAIService();
    const participants = conversation.participants.map(id => getAgentPersonality(id));
    const speakerIndex = conversation.participants.indexOf(speakerId);

    return await aiService.generateConversationResponse({
      participants,
      conversationHistory: conversation.messages,
      context: {
        location: conversation.location,
        timeOfDay: new Date().getHours(),
        topic: conversation.topic,
        turn: conversation.currentTurn
      },
      speakingAgent: speakerIndex
    });
  }

  private getNextSpeaker(conversation: ActiveConversation): number {
    // 简单的轮流发言策略
    if (conversation.messages.length === 0) {
      return conversation.participants[0];
    }

    const lastSpeakerName = conversation.messages[conversation.messages.length - 1].speaker;
    let lastSpeakerId: string | undefined;
    
    // 查找说话者ID
    for (const id of conversation.participants) {
      if (getAgentPersonality(id).name === lastSpeakerName) {
        lastSpeakerId = id.toString();
        break;
      }
    }

    if (!lastSpeakerId) {
      return conversation.participants[0];
    }

    const currentIndex = conversation.participants.indexOf(parseInt(lastSpeakerId));
    const nextIndex = (currentIndex + 1) % conversation.participants.length;
    
    return conversation.participants[nextIndex];
  }

  private shouldEndConversation(conversation: ActiveConversation): boolean {
    const now = Date.now();
    
    // 检查最大持续时间
    if (now - conversation.startTime > this.MAX_CONVERSATION_DURATION) {
      return true;
    }

    // 检查对话轮次（防止无限对话）
    if (conversation.currentTurn > 20) {
      return true;
    }

    // 检查最近的消息长度（如果消息越来越短，可能对话要结束了）
    const recentMessages = conversation.messages.slice(-3);
    if (recentMessages.length >= 3) {
      const avgLength = recentMessages.reduce((sum, msg) => sum + msg.content.length, 0) / recentMessages.length;
      if (avgLength < 10) { // 平均消息长度小于10字符
        return true;
      }
    }

    return false;
  }

  private setupConversationTimeout(conversationId: string): void {
    // 清除之前的超时
    const existingTimeout = this.conversationTimeouts.get(conversationId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // 设置新的超时
    const timeout = setTimeout(() => {
      this.endConversation(conversationId, 'timeout');
    }, this.INACTIVITY_TIMEOUT);

    this.conversationTimeouts.set(conversationId, timeout);
  }

  private storeConversationMemories(agentId: number, memories: AgentMemory[]): void {
    const personality = getAgentPersonality(agentId);
    personality.memories.push(...memories);
    
    // 保持记忆数量在合理范围内
    if (personality.memories.length > 100) {
      personality.memories = personality.memories
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 50);
    }
  }

  private generateConversationSummary(conversation: ActiveConversation, agentId: number): AgentMemory {
    const otherParticipants = conversation.participants
      .filter(id => id !== agentId)
      .map(id => getAgentPersonality(id).name)
      .join('、');

    const messageCount = conversation.messages.length;
    const duration = Math.round((Date.now() - conversation.startTime) / 1000);

    return {
      id: `conv_summary_${conversation.id}_${agentId}`,
      timestamp: Date.now(),
      type: 'conversation',
      content: `与${otherParticipants}在${conversation.location}进行了${duration}秒的对话，共${messageCount}轮`,
      participants: conversation.participants,
      importance: 0.6,
      emotional_impact: 0.1
    };
  }

  // 为对话结束后创建记忆到数据库
  private async createConversationMemories(conversation: ActiveConversation): Promise<void> {
    try {
      for (const participantId of conversation.participants) {
        // 生成对话总结
        const otherParticipants = conversation.participants
          .filter(id => id !== participantId)
          .map(id => getAgentPersonality(id).name)
          .join('、');

        const messageCount = conversation.messages.length;
        const duration = Math.round((Date.now() - conversation.startTime) / 1000);

        // 创建详细的对话记忆内容
        const conversationContent = conversation.messages.map(msg => 
          `${msg.speaker}: ${msg.content}`
        ).join('\n');

        const memoryContent = `与${otherParticipants}在${conversation.location}进行了对话（${duration}秒，${messageCount}轮）：\n${conversationContent}`;

        // 计算重要性：基于对话长度、持续时间和情绪强度
        let importance = 2; // 基础重要性
        if (messageCount > 10) importance += 1;
        if (duration > 120) importance += 1;
        if (conversation.messages.some(msg => msg.emotion && msg.emotion !== 'neutral')) {
          importance += 1;
        }
        importance = Math.min(importance, 5);

        // 通过API存储到数据库
        const response = await fetch('/api/memories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agentId: participantId,
            content: memoryContent,
            type: 'conversation',
            importance: importance,
          }),
        });

        if (response.ok) {
          console.log(`💾 为Agent ${participantId} 存储对话记忆: ${memoryContent.substring(0, 50)}...`);
        } else {
          console.error(`存储Agent ${participantId} 对话记忆失败:`, await response.text());
        }
      }
    } catch (error) {
      console.error('创建对话记忆失败:', error);
    }
  }
}

// 单例模式
let conversationManagerInstance: ConversationManager | null = null;

export function getConversationManager(): ConversationManager {
  if (!conversationManagerInstance) {
    conversationManagerInstance = new ConversationManager();
  }
  return conversationManagerInstance;
}

export { ConversationManager };