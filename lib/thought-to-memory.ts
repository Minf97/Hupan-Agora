// lib/thought-to-memory.ts - 思考记录转记忆服务

import { ThoughtRecord } from '@/hooks/useThoughtLogger';

// 节流和缓存配置
const CONVERSION_CONFIG = {
  COOLDOWN_PERIOD: 5000, // 5秒冷却时间
  MAX_QUEUE_SIZE: 10, // 最大队列大小
  BATCH_PROCESS_DELAY: 3000, // 批处理延迟
};

// 节流状态
let lastConversionTime = 0;
let conversionQueue: ThoughtRecord[] = [];
let isProcessingQueue = false;

// 自动将思考记录转换为记忆的服务
export class ThoughtToMemoryService {
  // 判断思考是否应该转换为记忆
  static shouldConvertToMemory(thought: ThoughtRecord): boolean {
    // 基于多个条件判断是否值得记忆
    const criteria = {
      hasHighConfidence: thought.metadata?.confidence && thought.metadata.confidence > 0.8,
      hasEmotion: !!thought.metadata?.emotion,
      isDecision: thought.type === 'decision',
      isImportantConversation: thought.type === 'conversation' && thought.content.length > 50,
      hasReasoning: !!thought.metadata?.reasoning,
      shouldInitiateChat: thought.metadata?.shouldInitiateChat,
    };

    // 至少满足两个条件才转换为记忆
    const metCriteria = Object.values(criteria).filter(Boolean).length;
    return metCriteria >= 2;
  }

  // 将思考记录转换为记忆数据
  static convertThoughtToMemory(thought: ThoughtRecord) {
    let memoryType: 'observation' | 'thought' | 'conversation' | 'reflection' | 'goal' | 'emotion';
    let importance = 1;
    let content = thought.content;

    // 根据思考类型确定记忆类型和重要性
    switch (thought.type) {
      case 'inner_thought':
        memoryType = 'thought';
        importance = 2;
        break;
      case 'decision':
        memoryType = 'goal';
        importance = 3;
        // 为决策类型添加上下文
        if (thought.metadata?.reasoning) {
          content = `决策: ${thought.content} (原因: ${thought.metadata.reasoning})`;
        }
        break;
      case 'conversation':
        memoryType = 'conversation';
        importance = 2;
        break;
      default:
        memoryType = 'observation';
    }

    // 调整重要性和类型基于元数据
    if (thought.metadata?.emotion) {
      if (['愤怒', '悲伤', '恐惧', '惊喜', '喜悦'].includes(thought.metadata.emotion)) {
        memoryType = 'emotion';
        importance += 1;
        content = `${content} (情绪: ${thought.metadata.emotion})`;
      }
    }

    if (thought.metadata?.confidence && thought.metadata.confidence > 0.9) {
      importance += 1;
    }

    if (thought.metadata?.shouldInitiateChat) {
      importance += 1;
      content = `${content} (需要主动交流)`;
    }

    // 限制重要性最大值
    importance = Math.min(importance, 5);

    return {
      agentId: thought.agentId,
      content,
      type: memoryType,
      importance,
    };
  }

  // 异步处理思考记录转记忆（优化版）
  static async processThoughtToMemory(thought: ThoughtRecord): Promise<boolean> {
    if (!this.shouldConvertToMemory(thought)) {
      return false;
    }

    // 节流检查
    const now = Date.now();
    if (now - lastConversionTime < CONVERSION_CONFIG.COOLDOWN_PERIOD) {
      // 添加到队列等待处理
      if (conversionQueue.length < CONVERSION_CONFIG.MAX_QUEUE_SIZE) {
        conversionQueue.push(thought);
        this.scheduleQueueProcessing();
      } else {
        console.warn('🚨 记忆转换队列已满，跳过思考:', thought.content.substring(0, 50));
      }
      return false;
    }

    lastConversionTime = now;
    return this.performConversion(thought);
  }

  // 执行实际转换
  private static async performConversion(thought: ThoughtRecord): Promise<boolean> {
    try {
      const memoryData = this.convertThoughtToMemory(thought);
      
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memoryData),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log(`💾 思考已转换为记忆: ${thought.agentName} - ${memoryData.type}`);
        return true;
      } else {
        console.error('转换记忆失败:', result.error);
        return false;
      }
    } catch (error) {
      console.error('处理思考转记忆失败:', error);
      return false;
    }
  }

  // 调度队列处理
  private static scheduleQueueProcessing() {
    if (isProcessingQueue) return;
    
    isProcessingQueue = true;
    setTimeout(async () => {
      await this.processQueue();
      isProcessingQueue = false;
    }, CONVERSION_CONFIG.BATCH_PROCESS_DELAY);
  }

  // 处理队列中的思考
  private static async processQueue() {
    if (conversionQueue.length === 0) return;
    
    const queueToProcess = [...conversionQueue];
    conversionQueue = [];
    
    console.log(`📦 开始批处理 ${queueToProcess.length} 个记忆转换`);
    
    let successCount = 0;
    for (const thought of queueToProcess) {
      const success = await this.performConversion(thought);
      if (success) successCount++;
      
      // 批处理间隔
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`🎉 批处理完成: ${successCount}/${queueToProcess.length} 成功`);
  }

  // 批量处理思考记录
  static async processBatchThoughts(thoughts: ThoughtRecord[]): Promise<number> {
    let successCount = 0;
    
    for (const thought of thoughts) {
      const success = await this.processThoughtToMemory(thought);
      if (success) successCount++;
      
      // 批处理间隔，防止请求过于频繁
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return successCount;
  }

  // 获取队列状态
  static getQueueStatus() {
    return {
      queueLength: conversionQueue.length,
      isProcessing: isProcessingQueue,
      lastConversionTime,
      cooldownRemaining: Math.max(0, CONVERSION_CONFIG.COOLDOWN_PERIOD - (Date.now() - lastConversionTime))
    };
  }

  // 强制处理队列（调试用）
  static async forceProcessQueue() {
    if (conversionQueue.length > 0) {
      await this.processQueue();
    }
  }
}