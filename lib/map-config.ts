// 地图配置
export const MAP_CONFIG = {
  width: 800,
  height: 600,
  gridSize: 20,
  obstacles: [
    // 建筑物
    { x: 100, y: 50, width: 200, height: 100 },
    { x: 400, y: 200, width: 150, height: 80 },
    { x: 200, y: 350, width: 180, height: 120 },
    { x: 550, y: 80, width: 120, height: 90 },
  ],
};

// 基础Agent类型
export interface Agent {
  id: number;
  name: string;
  x: number;
  y: number;
  color: string;
  moving: boolean;
}

// 增强版Agent状态接口
export interface AgentState {
  id: number;
  name: string;
  position: { x: number; y: number };
  target: { x: number; y: number } | null;
  status: 'idle' | 'walking' | 'talking' | 'seeking';
  color: string;
  avatar: string;
  // 历史对话
  // history: string;
  // 沉淀的知识
  // memory: string;
  // 用户背景
  // bg: string;
  talkingWith?: number; // 正在与哪个agent交谈
}

// 任务接口
export interface AgentTask {
  agentId: number;
  task: {
    type: 'move' | 'talk' | 'seek';
    to?: { x: number; y: number };
    targetAgentId?: number;
    duration?: number; // 如果是talk任务，可以指定谈话持续时间
  };
}

// 初始agent数据
export const INITIAL_AGENTS: Agent[] = [
  { id: 1, name: '张三', x: 5, y: 5, color: '#FF5733', moving: false },
  { id: 2, name: '李四', x: 15, y: 10, color: '#33A1FF', moving: false },
  { id: 3, name: '王五', x: 8, y: 18, color: '#33FF57', moving: false },
]; 