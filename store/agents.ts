import { create } from 'zustand';
import { Agent } from '@/db/schema/agents';

interface AgentState {
  agents: Agent[];
  loading: boolean;
  error: string | null;
  fetchAgents: () => Promise<void>;
  addAgent: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Agent | null>;
  updateAgent: (id: number, agent: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: number) => Promise<void>;
  getAgentById: (id: number) => Agent | undefined;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  loading: false,
  error: null,

  fetchAgents: async () => {
    try {
      set({ loading: true, error: null });
      const response = await fetch('/api/agents');
      
      if (!response.ok) {
        throw new Error('无法获取数字人数据');
      }
      
      const agents = await response.json();
      set({ agents, loading: false });
    } catch (error) {
      console.error('获取数字人失败:', error);
      set({ 
        error: error instanceof Error ? error.message : '无法加载数字人。请稍后再试。',
        loading: false 
      });
    }
  },

  addAgent: async (agentData) => {
    try {
      set({ loading: true, error: null });
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentData),
      });

      if (!response.ok) {
        throw new Error('无法创建数字人');
      }

      const newAgent = await response.json();
      set(state => ({ 
        agents: [...state.agents, newAgent],
        loading: false 
      }));
      
      return newAgent;
    } catch (error) {
      console.error('创建数字人失败:', error);
      set({ 
        error: error instanceof Error ? error.message : '创建数字人失败',
        loading: false 
      });
      return null;
    }
  },

  updateAgent: async (id, agentData) => {
    try {
      set({ loading: true, error: null });
      const response = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentData),
      });

      if (!response.ok) {
        throw new Error('无法更新数字人');
      }

      const updatedAgent = await response.json();
      set(state => ({
        agents: state.agents.map(agent => 
          agent.id === id ? updatedAgent : agent
        ),
        loading: false
      }));
    } catch (error) {
      console.error('更新数字人失败:', error);
      set({ 
        error: error instanceof Error ? error.message : '更新数字人失败',
        loading: false 
      });
    }
  },

  deleteAgent: async (id) => {
    try {
      set({ loading: true, error: null });
      const response = await fetch(`/api/agents/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('无法删除数字人');
      }

      set(state => ({
        agents: state.agents.filter(agent => agent.id !== id),
        loading: false
      }));
    } catch (error) {
      console.error('删除数字人失败:', error);
      set({ 
        error: error instanceof Error ? error.message : '删除数字人失败',
        loading: false 
      });
    }
  },

  getAgentById: (id) => {
    return get().agents.find(agent => agent.id === id);
  },
}));