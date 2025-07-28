// hooks/useThoughtLogger.ts - 内心思考和对话记录管理

import { useState, useRef, useEffect } from 'react';
import { ThoughtToMemoryService } from '@/lib/thought-to-memory';

// 节流和批处理配置
const BATCH_CONFIG = {
  BATCH_SIZE: 5, // 批处理大小
  BATCH_DELAY: 2000, // 2秒批处理延迟
  THROTTLE_DELAY: 500, // 节流延迟
};

export interface ThoughtRecord {
  id: string;
  timestamp: number;
  agentId: number;
  agentName: string;
  type: 'inner_thought' | 'decision' | 'conversation';
  content: string;
  metadata?: {
    confidence?: number;
    reasoning?: string;
    shouldInitiateChat?: boolean;
    emotion?: string;
    conversationId?: string;
  };
}

export const useThoughtLogger = () => {
  const [thoughts, setThoughts] = useState<ThoughtRecord[]>([]);
  const thoughtsRef = useRef<ThoughtRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 批处理队列
  const pendingThoughts = useRef<Omit<ThoughtRecord, 'id' | 'timestamp'>[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestTime = useRef<number>(0);

  // 组件挂载时加载最近的思考记录
  useEffect(() => {
    loadRecentThoughts();
  }, []);

  // 同步状态到ref
  useEffect(() => {
    thoughtsRef.current = thoughts;
  }, [thoughts]);

  // 从数据库加载最近的思考记录
  const loadRecentThoughts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/thoughts?limit=100');
      const result = await response.json();
      
      if (result.success) {
        setThoughts(result.data);
      } else {
        console.error('加载思考记录失败:', result.error);
      }
    } catch (error) {
      console.error('加载思考记录失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 批处理提交思考记录
  const processBatch = async () => {
    if (pendingThoughts.current.length === 0) return;
    
    const batch = [...pendingThoughts.current];
    pendingThoughts.current = [];
    
    try {
      // 批量提交
      const responses = await Promise.allSettled(
        batch.map(thought => 
          fetch('/api/thoughts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(thought),
          })
        )
      );
      
      // 处理响应
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        if (response.status === 'fulfilled' && response.value.ok) {
          const result = await response.value.json();
          if (result.success) {
            // 异步处理记忆转换（不阻塞）
            ThoughtToMemoryService.addThoughtToQueue(result.data);
          }
        }
      }
      
      console.log(`📦 批量处理了 ${batch.length} 条思考记录`);
    } catch (error) {
      console.error('批处理思考记录失败:', error);
    }
  };

  const addThought = async (thought: Omit<ThoughtRecord, 'id' | 'timestamp'>) => {
    try {
      // 节流检查
      const now = Date.now();
      if (now - lastRequestTime.current < BATCH_CONFIG.THROTTLE_DELAY) {
        console.log('🔄 思考记录被节流，跳过');
        return;
      }
      lastRequestTime.current = now;
      
      // 先添加到本地状态（即时响应）
      const tempThought: ThoughtRecord = {
        ...thought,
        id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        timestamp: Date.now(),
      };

      setThoughts(prev => {
        const updated = [...prev, tempThought];
        return updated.slice(-100);
      });

      console.log(`💭 ${thought.agentName} (${thought.type}):`, thought.content);

      // 添加到批处理队列
      pendingThoughts.current.push(thought);
      
      // 设置或重置批处理定时器
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      
      // 如果达到批处理大小，立即处理
      if (pendingThoughts.current.length >= BATCH_CONFIG.BATCH_SIZE) {
        processBatch();
      } else {
        // 否则设置延迟处理
        batchTimeoutRef.current = setTimeout(processBatch, BATCH_CONFIG.BATCH_DELAY);
      }
    } catch (error) {
      console.error('添加思考记录失败:', error);
    }
  };

  const addInnerThought = (
    agentId: number,
    agentName: string,
    internalMonologue: string,
    metadata?: {
      confidence?: number;
      reasoning?: string;
      shouldInitiateChat?: boolean;
    }
  ) => {
    addThought({
      agentId,
      agentName,
      type: 'inner_thought',
      content: internalMonologue,
      metadata,
    });
  };

  const addDecision = (
    agentId: number,
    agentName: string,
    decision: string,
    metadata?: {
      confidence?: number;
      reasoning?: string;
    }
  ) => {
    addThought({
      agentId,
      agentName,
      type: 'decision',
      content: decision,
      metadata,
    });
  };

  const addConversation = (
    agentId: number,
    agentName: string,
    message: string,
    metadata?: {
      emotion?: string;
      conversationId?: string;
    }
  ) => {
    addThought({
      agentId,
      agentName,
      type: 'conversation',
      content: message,
      metadata,
    });
  };

  const getThoughtsByAgent = (agentId: number) => {
    return thoughts.filter(thought => thought.agentId === agentId);
  };

  // const getRecentThoughts = (limit: number = 20) => {
  //   return thoughts.slice(-limit);
  // };

  const clearThoughts = async () => {
    try {
      const response = await fetch('/api/thoughts', {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        setThoughts([]);
      } else {
        console.error('清空思考记录失败:', result.error);
        // 即使数据库清空失败，也清空本地状态
        setThoughts([]);
      }
    } catch (error) {
      console.error('清空思考记录失败:', error);
      // 即使数据库清空失败，也清空本地状态
      setThoughts([]);
    }
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        // 组件卸载时处理剩余的批处理任务
        if (pendingThoughts.current.length > 0) {
          processBatch();
        }
      }
    };
  }, []);

  return {
    thoughts,
    addThought,
    addInnerThought,
    addDecision,
    addConversation,
    getThoughtsByAgent,
    getRecentThoughts: () => thoughts.slice(-20),
    clearThoughts,
    isLoading,
    refreshThoughts: loadRecentThoughts,
    // 新增: 手动触发批处理
    flushBatch: () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
      processBatch();
    },
  };
};