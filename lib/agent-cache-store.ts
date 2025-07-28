// lib/agent-cache-store.ts - Agent信息缓存存储
import { create } from 'zustand';

interface SimpleAgent {
  id: number;
  name: string;
  bg: string;
  tags?: string[];
  chatbot_history?: any[];
}

interface AgentCache {
  [agentId: number]: {
    data: SimpleAgent;
    timestamp: number;
    loading?: boolean;
  };
}

interface AgentCacheStore {
  cache: AgentCache;
  
  // 获取Agent信息（带缓存）
  getAgent: (agentId: number) => Promise<SimpleAgent>;
  
  // 清除特定Agent缓存
  clearAgent: (agentId: number) => void;
  
  // 清除所有缓存
  clearAll: () => void;
  
  // 预加载Agent信息
  preloadAgent: (agentId: number) => void;
  
  // 批量预加载
  preloadAgents: (agentIds: number[]) => void;
}

// 缓存过期时间：5分钟
const CACHE_EXPIRE_TIME = 5 * 60 * 1000;

const useAgentCacheStore = create<AgentCacheStore>((set, get) => ({
  cache: {},

  getAgent: async (agentId: number): Promise<SimpleAgent> => {
    const { cache } = get();
    const cached = cache[agentId];
    
    // 检查缓存是否有效
    if (cached && !cached.loading) {
      const isExpired = Date.now() - cached.timestamp > CACHE_EXPIRE_TIME;
      if (!isExpired) {
        console.log(`🎯 使用缓存的Agent ${agentId} 信息`);
        return cached.data;
      }
    }

    // 如果正在加载，等待加载完成
    if (cached?.loading) {
      console.log(`⏳ Agent ${agentId} 正在加载中，等待完成...`);
      
      // 轮询等待加载完成
      return new Promise((resolve) => {
        const checkLoading = () => {
          const currentCache = get().cache[agentId];
          if (!currentCache?.loading) {
            resolve(currentCache?.data || {
              id: agentId,
              name: `Agent ${agentId}`,
              bg: '一个普通的数字人'
            });
          } else {
            setTimeout(checkLoading, 100);
          }
        };
        checkLoading();
      });
    }

    // 设置加载状态
    set((state) => ({
      cache: {
        ...state.cache,
        [agentId]: {
          data: cached?.data || {
            id: agentId,
            name: `Agent ${agentId}`,
            bg: '一个普通的数字人'
          },
          timestamp: cached?.timestamp || 0,
          loading: true
        }
      }
    }));

    console.log(`🔄 从API获取Agent ${agentId} 信息`);

    try {
      const response = await fetch(`/api/agents/${agentId}`);
      if (response.ok) {
        const agent = await response.json();
        const agentData: SimpleAgent = {
          id: agent.id,
          name: agent.name,
          bg: agent.bg
        };

        // 更新缓存
        set((state) => ({
          cache: {
            ...state.cache,
            [agentId]: {
              data: agentData,
              timestamp: Date.now(),
              loading: false
            }
          }
        }));

        console.log(`✅ Agent ${agentId} 信息已缓存`);
        return agentData;
      }
    } catch (error) {
      console.error(`❌ 获取Agent ${agentId} 信息失败:`, error);
    }

    // 降级处理：返回默认信息并缓存
    const defaultAgent: SimpleAgent = {
      id: agentId,
      name: `Agent ${agentId}`,
      bg: '一个普通的数字人'
    };

    set((state) => ({
      cache: {
        ...state.cache,
        [agentId]: {
          data: defaultAgent,
          timestamp: Date.now(),
          loading: false
        }
      }
    }));

    return defaultAgent;
  },

  clearAgent: (agentId: number) => {
    set((state) => {
      const newCache = { ...state.cache };
      delete newCache[agentId];
      return { cache: newCache };
    });
    console.log(`🗑️ 清除Agent ${agentId} 缓存`);
  },

  clearAll: () => {
    set({ cache: {} });
    console.log(`🗑️ 清除所有Agent缓存`);
  },

  preloadAgent: (agentId: number) => {
    // 异步预加载，不阻塞
    get().getAgent(agentId).catch(error => {
      console.error(`预加载Agent ${agentId} 失败:`, error);
    });
  },

  preloadAgents: (agentIds: number[]) => {
    console.log(`🚀 批量预加载 ${agentIds.length} 个Agent信息`);
    agentIds.forEach(id => {
      get().preloadAgent(id);
    });
  }
}));

export default useAgentCacheStore;
export type { SimpleAgent };