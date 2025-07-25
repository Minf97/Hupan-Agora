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
    },
    // Main Corridor (connecting office to lobby)
    {
      id: 'main-corridor',
      name: '主走廊',
      type: RoomType.CORRIDOR,
      x: 270,
      y: 200,
      width: 35,
      height: 55,
      color: '#f5f5f5',
      description: '连接办公室和大厅的主要通道',
      capacity: 2,
      spawnPoints: [
        { x: 285, y: 220 },
        { x: 290, y: 235 }
      ]
    },
    // Side Corridor (connecting park to lobby)
    {
      id: 'side-corridor',
      name: '侧走廊',
      type: RoomType.CORRIDOR,
      x: 450,
      y: 250,
      width: 55,
      height: 50,
      color: '#f5f5f5',
      description: '连接花园和大厅的侧通道',
      capacity: 2,
      spawnPoints: [
        { x: 470, y: 270 },
        { x: 485, y: 285 }
      ]
    }
  ],

  // Wall system for proper boundaries
  walls: [
    // Office walls (complete enclosure)
    { x: 50, y: 50, width: 200, height: 5, type: WallType.EXTERIOR }, // North
    { x: 50, y: 50, width: 5, height: 150, type: WallType.EXTERIOR }, // West
    { x: 245, y: 50, width: 5, height: 150, type: WallType.EXTERIOR }, // East
    { x: 50, y: 195, width: 100, height: 5, type: WallType.EXTERIOR }, // South-left (door gap)
    { x: 200, y: 195, width: 50, height: 5, type: WallType.EXTERIOR }, // South-right (door gap)
    
    // Cafe walls (complete enclosure)
    { x: 50, y: 350, width: 5, height: 180, type: WallType.EXTERIOR }, // West
    { x: 50, y: 525, width: 220, height: 5, type: WallType.EXTERIOR }, // South
    { x: 265, y: 350, width: 5, height: 100, type: WallType.EXTERIOR }, // East-top (door gap)
    { x: 265, y: 500, width: 5, height: 30, type: WallType.EXTERIOR }, // East-bottom (door gap)
    { x: 50, y: 350, width: 50, height: 5, type: WallType.EXTERIOR }, // North-left (door gap)
    { x: 150, y: 350, width: 120, height: 5, type: WallType.EXTERIOR }, // North-right (door gap)
    
    // Park walls (more enclosed but with openings)
    { x: 500, y: 50, width: 250, height: 5, type: WallType.EXTERIOR }, // North
    { x: 745, y: 50, width: 5, height: 200, type: WallType.EXTERIOR }, // East
    { x: 500, y: 245, width: 100, height: 5, type: WallType.EXTERIOR }, // South-left (door gap)
    { x: 650, y: 245, width: 100, height: 5, type: WallType.EXTERIOR }, // South-right (door gap)
    { x: 500, y: 50, width: 5, height: 80, type: WallType.EXTERIOR }, // West-top (door gap)
    { x: 500, y: 180, width: 5, height: 70, type: WallType.EXTERIOR }, // West-bottom (door gap)
    { x: 500, y: 270, width: 5, height: 20, type: WallType.EXTERIOR }, // West-middle (door gap for side corridor)
    
    // Lobby walls (with proper door gaps)
    { x: 300, y: 250, width: 150, height: 5, type: WallType.INTERIOR }, // North
    { x: 300, y: 345, width: 150, height: 5, type: WallType.INTERIOR }, // South
    { x: 300, y: 250, width: 5, height: 40, type: WallType.INTERIOR }, // West-top (door gap)
    { x: 300, y: 310, width: 5, height: 40, type: WallType.INTERIOR }, // West-bottom (door gap)
    { x: 445, y: 250, width: 5, height: 20, type: WallType.INTERIOR }, // East-top (door gap)
    { x: 445, y: 290, width: 5, height: 60, type: WallType.INTERIOR }, // East-bottom (door gap)
    
    // Main Corridor walls (complete enclosure)
    { x: 270, y: 200, width: 5, height: 55, type: WallType.INTERIOR }, // West wall
    { x: 300, y: 200, width: 5, height: 50, type: WallType.INTERIOR }, // East wall-top (door gap)
    { x: 300, y: 270, width: 5, height: 25, type: WallType.INTERIOR }, // East wall-bottom (door gap)
    { x: 270, y: 200, width: 30, height: 5, type: WallType.INTERIOR }, // North wall
    { x: 270, y: 250, width: 30, height: 5, type: WallType.INTERIOR }, // South wall
    
    // Side Corridor walls (complete enclosure)
    { x: 450, y: 250, width: 55, height: 5, type: WallType.INTERIOR }, // North wall
    { x: 450, y: 295, width: 55, height: 5, type: WallType.INTERIOR }, // South wall
    // Left wall has door gap to lobby
    { x: 450, y: 250, width: 5, height: 20, type: WallType.INTERIOR }, // West-top (door gap)
    { x: 450, y: 290, width: 5, height: 10, type: WallType.INTERIOR }, // West-bottom (door gap)
    // Right wall has door gap to park
    { x: 500, y: 250, width: 5, height: 20, type: WallType.INTERIOR }, // East-top (door gap)
    { x: 500, y: 290, width: 5, height: 10, type: WallType.INTERIOR }, // East-bottom (door gap)
    
    // Connecting walls between rooms
    { x: 270, y: 350, width: 5, height: 50, type: WallType.INTERIOR }, // Cafe-Lobby vertical connector
    { x: 270, y: 255, width: 30, height: 5, type: WallType.INTERIOR }, // Main corridor to open area
  ],

  // Door/opening system
  doors: [
    // Office to main corridor
    { x: 150, y: 195, width: 50, height: 5, connects: ['office', 'main-corridor'] as [string, string], isOpen: true },
    // Main corridor to lobby
    { x: 300, y: 290, width: 5, height: 20, connects: ['main-corridor', 'lobby'] as [string, string], isOpen: true },
    // Lobby to side corridor  
    { x: 445, y: 270, width: 5, height: 20, connects: ['lobby', 'side-corridor'] as [string, string], isOpen: true },
    // Side corridor to park
    { x: 500, y: 270, width: 5, height: 20, connects: ['side-corridor', 'park'] as [string, string], isOpen: true },
    // Cafe to lobby (direct connection)
    { x: 265, y: 450, width: 5, height: 50, connects: ['cafe', 'lobby'] as [string, string], isOpen: true },
    // Park alternative entrance
    { x: 500, y: 130, width: 5, height: 50, connects: ['park', 'main-corridor'] as [string, string], isOpen: true },
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