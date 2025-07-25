// 地图配置
// Room types for semantic understanding
export enum RoomType {
  OFFICE = 'office',
  CAFE = 'cafe',
  PARK = 'park',
  CORRIDOR = 'corridor',
  LOBBY = 'lobby'
}

// Wall types for different rendering and collision behavior
export enum WallType {
  EXTERIOR = 'exterior',
  INTERIOR = 'interior',
  WINDOW = 'window'
}

// Door/opening definitions
export interface Door {
  x: number;
  y: number;
  width: number;
  height: number;
  connects: [string, string]; // Room IDs this door connects
  isOpen: boolean;
}

// Wall definitions
export interface Wall {
  x: number;
  y: number;
  width: number;
  height: number;
  type: WallType;
  roomId?: string;
}

// Room definitions with metadata
export interface Room {
  id: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  description: string;
  capacity: number;
  spawnPoints: { x: number; y: number }[];
}

export const MAP_CONFIG = {
  width: 800,
  height: 600,
  gridSize: 20,
  
  // Enhanced room-based layout
  rooms: [
    // Office Room (top-left)
    {
      id: 'office',
      name: '办公室',
      type: RoomType.OFFICE,
      x: 50,
      y: 50,
      width: 200,
      height: 150,
      color: '#e8f4f8',
      description: '安静的工作环境，适合正式会议和专注工作',
      capacity: 4,
      spawnPoints: [
        { x: 100, y: 100 },
        { x: 150, y: 120 },
        { x: 200, y: 100 },
        { x: 120, y: 160 }
      ]
    },
    // Cafe Room (bottom-left)
    {
      id: 'cafe',
      name: '咖啡厅',
      type: RoomType.CAFE,
      x: 50,
      y: 350,
      width: 220,
      height: 180,
      color: '#fff8e1',
      description: '轻松的社交场所，适合非正式交流和休息',
      capacity: 6,
      spawnPoints: [
        { x: 100, y: 400 },
        { x: 160, y: 420 },
        { x: 220, y: 400 },
        { x: 120, y: 480 },
        { x: 200, y: 470 },
        { x: 150, y: 450 }
      ]
    },
    // Park Area (top-right)
    {
      id: 'park',
      name: '花园',
      type: RoomType.PARK,
      x: 500,
      y: 50,
      width: 250,
      height: 200,
      color: '#f1f8e9',
      description: '开放的户外空间，适合散步和放松',
      capacity: 8,
      spawnPoints: [
        { x: 550, y: 100 },
        { x: 600, y: 80 },
        { x: 650, y: 120 },
        { x: 700, y: 100 },
        { x: 580, y: 160 },
        { x: 630, y: 180 },
        { x: 680, y: 160 },
        { x: 720, y: 200 }
      ]
    },
    // Central Lobby (center)
    {
      id: 'lobby',
      name: '大厅',
      type: RoomType.LOBBY,
      x: 300,
      y: 250,
      width: 150,
      height: 100,
      color: '#fafafa',
      description: '中央聚集区域，连接各个房间',
      capacity: 5,
      spawnPoints: [
        { x: 330, y: 280 },
        { x: 375, y: 290 },
        { x: 420, y: 280 },
        { x: 350, y: 320 },
        { x: 400, y: 310 }
      ]
    }
  ],

  // Wall system for proper boundaries
  walls: [
    // Office walls
    { x: 50, y: 50, width: 200, height: 5, type: WallType.EXTERIOR }, // North
    { x: 50, y: 50, width: 5, height: 150, type: WallType.EXTERIOR }, // West
    { x: 245, y: 50, width: 5, height: 150, type: WallType.EXTERIOR }, // East
    { x: 50, y: 195, width: 100, height: 5, type: WallType.EXTERIOR }, // South-left
    { x: 200, y: 195, width: 50, height: 5, type: WallType.EXTERIOR }, // South-right
    
    // Cafe walls
    { x: 50, y: 350, width: 5, height: 180, type: WallType.EXTERIOR }, // West
    { x: 50, y: 525, width: 220, height: 5, type: WallType.EXTERIOR }, // South
    { x: 265, y: 350, width: 5, height: 100, type: WallType.EXTERIOR }, // East-bottom
    { x: 265, y: 500, width: 5, height: 30, type: WallType.EXTERIOR }, // East-top
    { x: 100, y: 350, width: 170, height: 5, type: WallType.EXTERIOR }, // North
    
    // Park walls (partial - it's more open)
    { x: 500, y: 50, width: 250, height: 5, type: WallType.EXTERIOR }, // North
    { x: 745, y: 50, width: 5, height: 200, type: WallType.EXTERIOR }, // East
    { x: 500, y: 245, width: 100, height: 5, type: WallType.EXTERIOR }, // South-left
    { x: 650, y: 245, width: 100, height: 5, type: WallType.EXTERIOR }, // South-right
    { x: 500, y: 50, width: 5, height: 80, type: WallType.EXTERIOR }, // West-top
    { x: 500, y: 180, width: 5, height: 70, type: WallType.EXTERIOR }, // West-bottom
    
    // Lobby walls
    { x: 300, y: 250, width: 150, height: 5, type: WallType.INTERIOR }, // North
    { x: 300, y: 345, width: 150, height: 5, type: WallType.INTERIOR }, // South
    { x: 300, y: 250, width: 5, height: 40, type: WallType.INTERIOR }, // West-top
    { x: 300, y: 310, width: 5, height: 40, type: WallType.INTERIOR }, // West-bottom
    { x: 445, y: 250, width: 5, height: 40, type: WallType.INTERIOR }, // East-top
    { x: 445, y: 310, width: 5, height: 40, type: WallType.INTERIOR }, // East-bottom
    
    // Corridor walls (connecting passages)
    { x: 270, y: 195, width: 5, height: 60, type: WallType.INTERIOR }, // Office-Lobby connector
    { x: 270, y: 350, width: 5, height: 50, type: WallType.INTERIOR }, // Cafe-Lobby connector
    { x: 450, y: 250, width: 55, height: 5, type: WallType.INTERIOR }, // Lobby-Park connector top
    { x: 450, y: 300, width: 55, height: 5, type: WallType.INTERIOR }, // Lobby-Park connector bottom
  ],

  // Door/opening system
  doors: [
    // Office to corridor
    { x: 150, y: 195, width: 50, height: 5, connects: ['office', 'corridor'] as [string, string], isOpen: true },
    // Cafe to lobby
    { x: 265, y: 450, width: 5, height: 50, connects: ['cafe', 'lobby'] as [string, string], isOpen: true },
    // Office to lobby (via corridor)
    { x: 300, y: 290, width: 5, height: 20, connects: ['corridor', 'lobby'] as [string, string], isOpen: true },
    // Lobby to park
    { x: 600, y: 245, width: 50, height: 5, connects: ['lobby', 'park'] as [string, string], isOpen: true },
    // Park side entrance
    { x: 500, y: 130, width: 5, height: 50, connects: ['park', 'corridor'] as [string, string], isOpen: true },
  ],

  // Legacy obstacles for backward compatibility
  obstacles: [
    // These will be gradually replaced by the wall system
    // Keeping essential ones that don't conflict with new rooms
    { x: 600, y: 400, width: 120, height: 80 }, // External building
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