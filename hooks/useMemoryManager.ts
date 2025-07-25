// hooks/useMemoryManager.ts - 记忆管理 Hook

import { useState, useEffect, useCallback } from 'react';

export interface MemoryRecord {
  id: number;
  agentId: number;
  content: string;
  type: 'observation' | 'thought' | 'conversation' | 'reflection' | 'goal' | 'emotion';
  importance: number;
  similarity?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface MemorySearchResult extends MemoryRecord {
  similarity: number;
}

export const useMemoryManager = (agentId?: number) => {
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取代理的所有记忆
  const loadMemories = useCallback(async (targetAgentId?: number) => {
    const id = targetAgentId || agentId;
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/memories?agentId=${id}&limit=50`);
      const result = await response.json();
      
      if (response.ok) {
        setMemories(result);
      } else {
        setError(result.error || '获取记忆失败');
      }
    } catch (error) {
      console.error('加载记忆失败:', error);
      setError('网络错误');
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  // 添加新记忆
  const addMemory = useCallback(async (
    content: string,
    type: MemoryRecord['type'],
    importance?: number,
    targetAgentId?: number
  ): Promise<MemoryRecord | null> => {
    const id = targetAgentId || agentId;
    if (!id) {
      setError('缺少代理ID');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: id,
          content,
          type,
          importance,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // 添加到本地状态
        setMemories(prev => [result, ...prev]);
        return result;
      } else {
        setError(result.error || '添加记忆失败');
        return null;
      }
    } catch (error) {
      console.error('添加记忆失败:', error);
      setError('网络错误');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  // 搜索相似记忆
  const searchMemories = useCallback(async (
    query: string,
    limit: number = 5,
    targetAgentId?: number
  ): Promise<MemorySearchResult[]> => {
    const id = targetAgentId || agentId;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
      });
      
      if (id) {
        params.append('agentId', id.toString());
      }
      
      const response = await fetch(`/api/memories/search?${params}`);
      const results = await response.json();
      
      if (response.ok) {
        setSearchResults(results);
        return results;
      } else {
        setError(results.error || '搜索记忆失败');
        return [];
      }
    } catch (error) {
      console.error('搜索记忆失败:', error);
      setError('网络错误');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  // 根据类型获取记忆
  const getMemoriesByType = useCallback((type: MemoryRecord['type']) => {
    return memories.filter(memory => memory.type === type);
  }, [memories]);

  // 获取重要记忆
  const getImportantMemories = useCallback((minImportance: number = 3) => {
    return memories
      .filter(memory => memory.importance >= minImportance)
      .sort((a, b) => b.importance - a.importance);
  }, [memories]);

  // 从思考记录生成记忆
  const createMemoryFromThought = useCallback(async (
    thought: {
      agentId: number;
      agentName: string;
      type: 'inner_thought' | 'decision' | 'conversation';
      content: string;
      metadata?: any;
    }
  ): Promise<MemoryRecord | null> => {
    // 将思考记录转换为记忆类型
    let memoryType: MemoryRecord['type'];
    let importance = 1;
    
    switch (thought.type) {
      case 'inner_thought':
        memoryType = 'thought';
        importance = 2;
        break;
      case 'decision':
        memoryType = 'goal';
        importance = 3;
        break;
      case 'conversation':
        memoryType = 'conversation';
        importance = 2;
        break;
      default:
        memoryType = 'observation';
    }

    // 如果有情绪信息，调整重要性
    if (thought.metadata?.emotion) {
      importance += 1;
      memoryType = 'emotion';
    }

    // 如果置信度很高，提升重要性
    if (thought.metadata?.confidence && thought.metadata.confidence > 0.8) {
      importance += 1;
    }

    return await addMemory(thought.content, memoryType, importance, thought.agentId);
  }, [addMemory]);

  // 自动加载记忆
  useEffect(() => {
    if (agentId) {
      loadMemories();
    }
  }, [agentId, loadMemories]);

  return {
    memories,
    searchResults,
    isLoading,
    error,
    loadMemories,
    addMemory,
    searchMemories,
    getMemoriesByType,
    getImportantMemories,
    createMemoryFromThought,
  };
};