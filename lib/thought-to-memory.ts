// lib/thought-to-memory.ts - 智能记忆转换服务
// 只将真正重要的思考转换为长期记忆

import { ThoughtRecord } from "@/hooks/useThoughtLogger";

// 记忆转换配置
const MEMORY_CONFIG = {
  COOLDOWN_PERIOD: 10000, // 10秒冷却时间，避免频繁转换
  MAX_QUEUE_SIZE: 5, // 减少队列大小
  BATCH_PROCESS_DELAY: 5000, // 批处理延迟
};

// 内存中的转换状态
let lastConversionTime = 0;
let conversionQueue: ThoughtRecord[] = [];
let isProcessingQueue = false;

// 智能记忆转换服务
export class ThoughtToMemoryService {
  
  // 🧠 判断思考是否应该转换为长期记忆 - 更严格的标准
  static shouldConvertToMemory(thought: ThoughtRecord): boolean {
    // 🚫 内心 OS 和普通思考不应该成为记忆
    if (thought.type === "inner_thought" && !thought.metadata?.shouldInitiateChat) {
      return false;
    }
    
    // ✅ 只有以下情况才转换为记忆：
    const criteria = {
      // 高置信度的重要决策
      isImportantDecision: 
        thought.type === "decision" && 
        thought.metadata?.confidence && 
        thought.metadata.confidence > 0.7,
        
      // 有意义的对话（包含情感或长内容）
      isMeaningfulConversation:
        thought.type === "conversation" && 
        (thought.metadata?.emotion || thought.content.length > 100),
        
      // 导致聊天的内心想法（重要的社交决策）
      isSocialDecision: 
        thought.type === "inner_thought" && 
        thought.metadata?.shouldInitiateChat &&
        thought.metadata?.confidence && 
        thought.metadata.confidence > 0.6,
    };

    // 只要满足一个严格条件就转换
    return Object.values(criteria).some(Boolean);
  }

  // 🔄 将思考转换为结构化记忆数据
  static convertThoughtToMemory(thought: ThoughtRecord) {
    let memoryType: "social_interaction" | "important_decision" | "emotional_event" | "conversation_memory";
    let importance = 1;
    let content = thought.content;

    // 根据思考类型确定记忆类型
    if (thought.type === "decision" && thought.metadata?.shouldInitiateChat) {
      memoryType = "social_interaction";
      importance = 3; // 社交决策很重要
      content = `决定：${thought.content}`;
    } else if (thought.type === "conversation") {
      memoryType = "conversation_memory";
      importance = 2;
      content = `对话：${thought.content}`;
    } else if (thought.metadata?.emotion) {
      memoryType = "emotional_event";
      importance = 2;
      content = `情感体验：${thought.content}`;
    } else {
      memoryType = "important_decision";
      importance = 1;
      content = `思考：${thought.content}`;
    }

    return {
      agentId: thought.agentId,
      type: memoryType,
      content: content,
      importance: importance,
      participants: thought.metadata?.conversationId ? [] : undefined, // 对话相关的记忆可以包含参与者
      relatedEventId: thought.metadata?.conversationId || thought.id,
      metadata: {
        originalThoughtType: thought.type,
        confidence: thought.metadata?.confidence,
        emotion: thought.metadata?.emotion,
        reasoning: thought.metadata?.reasoning,
        timestamp: thought.timestamp,
      }
    };
  }

  // 📝 添加思考到转换队列（节流处理）
  static addThoughtToQueue(thought: ThoughtRecord): void {
    const now = Date.now();
    
    // 检查冷却时间
    if (now - lastConversionTime < MEMORY_CONFIG.COOLDOWN_PERIOD) {
      console.log(`⏳ 记忆转换冷却中，跳过: ${thought.agentName}`);
      return;
    }

    // 检查是否应该转换
    if (!this.shouldConvertToMemory(thought)) {
      console.log(`🚫 思考不需要转换为记忆: ${thought.agentName} - ${thought.type}`);
      return;
    }

    // 添加到队列
    conversionQueue.push(thought);
    
    // 保持队列大小
    if (conversionQueue.length > MEMORY_CONFIG.MAX_QUEUE_SIZE) {
      conversionQueue = conversionQueue.slice(-MEMORY_CONFIG.MAX_QUEUE_SIZE);
    }

    console.log(`📥 思考已添加到记忆转换队列: ${thought.agentName} (队列长度: ${conversionQueue.length})`);
    
    // 触发队列处理
    this.scheduleQueueProcessing();
  }

  // ⏰ 调度队列处理
  private static scheduleQueueProcessing(): void {
    if (isProcessingQueue || conversionQueue.length === 0) return;

    setTimeout(async () => {
      await this.processQueue();
    }, MEMORY_CONFIG.BATCH_PROCESS_DELAY);
  }

  // 🔄 处理转换队列
  private static async processQueue(): Promise<void> {
    if (isProcessingQueue || conversionQueue.length === 0) return;

    isProcessingQueue = true;
    console.log(`🔄 开始处理记忆转换队列，共 ${conversionQueue.length} 项`);

    try {
      const results = await this.processBatchThoughts([...conversionQueue]);
      console.log(`✅ 队列处理完成: ${results.successCount}/${conversionQueue.length} 成功`);
      
      // 清空队列
      conversionQueue = [];
      lastConversionTime = Date.now();
      
    } catch (error) {
      console.error('❌ 队列处理失败:', error);
    } finally {
      isProcessingQueue = false;
    }
  }

  // 🎯 执行实际的记忆转换
  private static async performConversion(thought: ThoughtRecord): Promise<boolean> {
    try {
      const memoryData = this.convertThoughtToMemory(thought);
      
      console.log(`💾 转换记忆数据:`, memoryData);
      
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(memoryData),
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`✅ 思考已转换为记忆: ${thought.agentName} - ${memoryData.type}`);
        return true;
      } else {
        console.error("❌ 转换记忆失败:", result.error);
        return false;
      }
    } catch (error) {
      console.error("❌ 处理思考转记忆失败:", error);
      return false;
    }
  }

  // 📦 批量处理思考转换
  private static async processBatchThoughts(thoughts: ThoughtRecord[]): Promise<{ successCount: number }> {
    let successCount = 0;

    for (const thought of thoughts) {
      try {
        const success = await this.performConversion(thought);
        if (success) successCount++;
      } catch (error) {
        console.error(`❌ 转换思考失败 ${thought.agentName}:`, error);
      }
    }

    return { successCount };
  }

  // 📊 获取队列状态
  static getQueueStatus() {
    return {
      queueLength: conversionQueue.length,
      isProcessing: isProcessingQueue,
      lastConversionTime,
      cooldownRemaining: Math.max(0, MEMORY_CONFIG.COOLDOWN_PERIOD - (Date.now() - lastConversionTime))
    };
  }

  // 🔧 强制处理队列（用于调试）
  static async forceProcessQueue(): Promise<void> {
    if (conversionQueue.length === 0) {
      console.log('📭 队列为空，无需处理');
      return;
    }

    await this.processQueue();
  }
}