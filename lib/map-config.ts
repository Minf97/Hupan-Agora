// 地图配置
export const MAP_CONFIG = {
  width: 800,
  height: 500,
  gridSize: 20,
  obstacles: [
    { x: 100, y: 100, width: 100, height: 80 },  // 建筑物
    { x: 300, y: 200, width: 120, height: 70 },  // 建筑物
    { x: 500, y: 150, width: 80, height: 100 },  // 建筑物
    { x: 200, y: 350, width: 150, height: 60 }   // 建筑物
  ]
};

// Agent类型定义
export type Agent = {
  id: number;
  name: string;
  x: number;
  y: number;
  color: string;
  target?: { x: number; y: number };
  path?: { x: number; y: number }[];
  pathIndex?: number;
  moving: boolean;
};

// 初始agent数据
export const INITIAL_AGENTS: Agent[] = [
  { id: 1, name: '张三', x: 5, y: 5, color: '#FF5733', moving: false },
  { id: 2, name: '李四', x: 15, y: 10, color: '#33A1FF', moving: false },
  { id: 3, name: '王五', x: 8, y: 18, color: '#33FF57', moving: false },
]; 