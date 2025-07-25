// hooks/useThoughtLogger.ts - 内心思考和对话记录管理

import { useState, useRef, useEffect } from 'react';

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

  // 同步状态到ref
  useEffect(() => {
    thoughtsRef.current = thoughts;
  }, [thoughts]);

  const addThought = (thought: Omit<ThoughtRecord, 'id' | 'timestamp'>) => {
    const newThought: ThoughtRecord = {
      ...thought,
      id: `thought_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
    };

    setThoughts(prev => {
      const updated = [...prev, newThought];
      // 保持最新100条记录
      return updated.slice(-100);
    });

    console.log(`💭 ${thought.agentName} (${thought.type}):`, thought.content);
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

  const getRecentThoughts = (limit: number = 20) => {
    return thoughts.slice(-limit);
  };

  const clearThoughts = () => {
    setThoughts([]);
  };

  return {
    thoughts,
    addThought,
    addInnerThought,
    addDecision,
    addConversation,
    getThoughtsByAgent,
    getRecentThoughts,
    clearThoughts,
  };
};