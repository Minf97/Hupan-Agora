// 地图配置
// Room types for semantic understanding
export enum RoomType {
  OFFICE = "office",
  CAFE = "cafe",
  PARK = "park",
  CORRIDOR = "corridor",
  LOBBY = "lobby",
}

// Wall types for different rendering and collision behavior
export enum WallType {
  EXTERIOR = "exterior",
  INTERIOR = "interior",
  WINDOW = "window",
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
  width: 1200,
  height: 1000,
  gridSize: 20,

  rooms: [
    // --- Core Hall ---
    {
      id: 'hall',
      name: 'Hall',
      type: RoomType.LOBBY,
      x: 380, y: 320, width: 440, height: 360,
      color: '#f5f5f5',
      description: '中央大厅，连接所有支路',
      capacity: 10,
      spawnPoints: [
        { x: 540, y: 400 }, { x: 620, y: 420 },
        { x: 500, y: 520 }, { x: 660, y: 560 }
      ]
    },

    // --- Top spine (north) ---
    { // 竖直上行到顶部走廊
      id: 'corridor-north',
      name: '北向竖廊',
      type: RoomType.CORRIDOR,
      x: 720, y: 200, width: 60, height: 120,
      color: '#eeeeee', description: '连到顶部主走廊',
      capacity: 2, spawnPoints: [{ x: 750, y: 260 }]
    },
    { // 顶部走廊（向左）
      id: 'corridor-top-west',
      name: '顶部走廊-西',
      type: RoomType.CORRIDOR,
      x: 120, y: 200, width: 600, height: 60,
      color: '#eeeeee', description: '顶部主走廊（向左长伸）',
      capacity: 4, spawnPoints: [{ x: 300, y: 230 }, { x: 620, y: 230 }]
    },
    { // 顶部走廊（向右，去 D）
      id: 'corridor-top-east',
      name: '顶部走廊-东',
      type: RoomType.CORRIDOR,
      x: 780, y: 200, width: 120, height: 60,
      color: '#eeeeee', description: '通往房间 D 的短支路',
      capacity: 2, spawnPoints: [{ x: 820, y: 230 }]
    },

    // --- Left branch + Room A ---
    {
      id: 'corridor-left-branch',
      name: '左向分支竖廊',
      type: RoomType.CORRIDOR,
      x: 200, y: 260, width: 60, height: 260,
      color: '#eeeeee',
      description: '从顶部走廊下探的分支',
      capacity: 2, spawnPoints: [{ x: 230, y: 360 }]
    },
    {
      id: 'room-a',
      name: '房间 A',
      type: RoomType.OFFICE,
      x: 80, y: 320, width: 160, height: 240,
      color: '#e3f2fd',
      description: '左侧房间，连到分支竖廊',
      capacity: 3, spawnPoints: [{ x: 120, y: 380 }, { x: 140, y: 460 }]
    },

    // --- Room D (top-right) ---
    {
      id: 'room-d',
      name: '房间 D',
      type: RoomType.CAFE,
      x: 900, y: 80, width: 160, height: 120,
      color: '#fff8e1',
      description: '顶端右侧房间，门在下沿',
      capacity: 3, spawnPoints: [{ x: 940, y: 120 }]
    },

    // --- Bottom spine to Room F ---
    {
      id: 'corridor-south',
      name: '南向竖廊',
      type: RoomType.CORRIDOR,
      x: 560, y: 680, width: 60, height: 120,
      color: '#eeeeee',
      description: '从 Hall 向下到底部横廊',
      capacity: 2, spawnPoints: [{ x: 590, y: 740 }]
    },
    {
      id: 'corridor-bottom-east',
      name: '底部横廊-东',
      type: RoomType.CORRIDOR,
      x: 620, y: 740, width: 420, height: 60,
      color: '#eeeeee',
      description: '向右到 F 的底部走廊',
      capacity: 3, spawnPoints: [{ x: 820, y: 770 }]
    },
    {
      id: 'room-f',
      name: '房间 F',
      type: RoomType.OFFICE,
      x: 1040, y: 760, width: 140, height: 120,
      color: '#e8f5e9',
      description: '底部靠右房间，门在西侧',
      capacity: 3, spawnPoints: [{ x: 1100, y: 800 }]
    }
  ],

  // ---- DOORS：都与 walls 保持几何对齐（留了缺口）----
  doors: [
    // Hall ⇄ 北向竖廊（在 Hall 北墙偏右）
    { x: 740, y: 320, width: 40, height: 5, connects: ['hall', 'corridor-north'] as [string, string], isOpen: true },

    // 顶部走廊东段 ⇄ D（D 的门在底边中央）
    { x: 940, y: 200, width: 40, height: 5, connects: ['corridor-top-east', 'room-d'] as [string, string], isOpen: true },

    // 顶部走廊西段 ⇄ 左向分支竖廊（在顶部走廊下沿开口处）
    { x: 220, y: 260, width: 40, height: 5, connects: ['corridor-top-west', 'corridor-left-branch'] as [string, string], isOpen: true },

    // 左向分支竖廊 ⇄ A（A 的门在东墙中部）
    { x: 240, y: 400, width: 5, height: 40, connects: ['corridor-left-branch', 'room-a'] as [string, string], isOpen: true },

    // Hall ⇄ 南向竖廊（在 Hall 南墙正中略偏左）
    { x: 580, y: 680, width: 40, height: 5, connects: ['hall', 'corridor-south'] as [string, string], isOpen: true },

    // 底部横廊 ⇄ F（F 的门在西墙中部）
    { x: 1040, y: 780, width: 5, height: 40, connects: ['corridor-bottom-east', 'room-f'] as [string, string], isOpen: true },
  ],

  // ---- WALLS：所有关键边界；与门位置错开，留出通行缺口 ----
  walls: [
    // Hall 外墙（北墙在 x=740..780 处留口）
    { x: 380, y: 320, width: 360, height: 5, type: WallType.INTERIOR },  // 北-左段 (380→740)
    { x: 780, y: 320, width: 40, height: 5, type: WallType.INTERIOR },   // 北-右段 (780→820)
    { x: 380, y: 680, width: 200, height: 5, type: WallType.INTERIOR },  // 南-左段 (380→580)
    { x: 600, y: 680, width: 220, height: 5, type: WallType.INTERIOR },  // 南-右段 (600→820)
    { x: 380, y: 320, width: 5, height: 360, type: WallType.INTERIOR },  // 西
    { x: 815, y: 320, width: 5, height: 360, type: WallType.INTERIOR },  // 东

    // 北向竖廊（底部与 Hall 相连，不封底）
    { x: 720, y: 200, width: 60, height: 5, type: WallType.INTERIOR },   // 顶
    { x: 720, y: 200, width: 5, height: 120, type: WallType.INTERIOR },  // 左
    { x: 775, y: 200, width: 5, height: 120, type: WallType.INTERIOR },  // 右

    // 顶部走廊-西（在 x=200..260 留缺口接分支廊）
    { x: 120, y: 200, width: 600, height: 5, type: WallType.INTERIOR },  // 顶
    { x: 120, y: 260, width: 80, height: 5, type: WallType.INTERIOR },   // 底-左段 (120→200)
    { x: 260, y: 260, width: 460, height: 5, type: WallType.INTERIOR },  // 底-右段 (260→720)
    { x: 120, y: 200, width: 5, height: 60, type: WallType.INTERIOR },   // 西端
    // 东端与北向竖廊相接，不加封口

    // 顶部走廊-东（东端靠近 D，下边与 D 无直接重叠）
    { x: 780, y: 200, width: 120, height: 5, type: WallType.INTERIOR },  // 顶
    { x: 780, y: 260, width: 120, height: 5, type: WallType.INTERIOR },  // 底
    // 东立面不封，因与 D 的门在 D 南侧衔接（见下文）

    // 左向分支竖廊（顶端与顶部走廊-西相连，不封顶）
    { x: 200, y: 260, width: 60, height: 5, type: WallType.INTERIOR },   // 底
    { x: 200, y: 260, width: 5, height: 260, type: WallType.INTERIOR },  // 西
    { x: 255, y: 260, width: 5, height: 260, type: WallType.INTERIOR },  // 东

    // 房间 A（东墙在 y=400..440 留门口）
    { x: 80,  y: 320, width: 160, height: 5, type: WallType.EXTERIOR },  // 北
    { x: 80,  y: 560, width: 160, height: 5, type: WallType.EXTERIOR },  // 南
    { x: 80,  y: 320, width: 5,   height: 240, type: WallType.EXTERIOR },// 西
    { x: 240, y: 320, width: 5,   height: 80,  type: WallType.EXTERIOR },// 东-上段
    { x: 240, y: 440, width: 5,   height: 120, type: WallType.EXTERIOR },// 东-下段

    // 房间 D（南边在 x=940..980 留门口）
    { x: 900, y: 80,  width: 160, height: 5, type: WallType.EXTERIOR },  // 北
    { x: 900, y: 200, width: 40,  height: 5, type: WallType.EXTERIOR },  // 南-左段
    { x: 980, y: 200, width: 80,  height: 5, type: WallType.EXTERIOR },  // 南-右段
    { x: 900, y: 80,  width: 5,   height: 120, type: WallType.EXTERIOR },// 西
    { x: 1060,y: 80,  width: 5,   height: 120, type: WallType.EXTERIOR },// 东

    // 南向竖廊（顶端与 Hall 相连，不封顶；底端与底部横廊相连，不封底）
    { x: 560, y: 680, width: 5,   height: 120, type: WallType.INTERIOR },// 西
    { x: 615, y: 680, width: 5,   height: 120, type: WallType.INTERIOR },// 东

    // 底部横廊-东（西端与南向竖廊相连不封口；东端接 F 的门）
    { x: 620, y: 740, width: 420, height: 5, type: WallType.INTERIOR },  // 顶
    { x: 620, y: 800, width: 420, height: 5, type: WallType.INTERIOR },  // 底

    // 房间 F（西墙在 y=780..820 留门口）
    { x: 1040, y: 760, width: 140, height: 5, type: WallType.EXTERIOR }, // 北
    { x: 1040, y: 880, width: 140, height: 5, type: WallType.EXTERIOR }, // 南
    { x: 1040, y: 760, width: 5,   height: 20, type: WallType.EXTERIOR },// 西-上段
    { x: 1040, y: 820, width: 5,   height: 60, type: WallType.EXTERIOR },// 西-下段
    { x: 1180, y: 760, width: 5,   height: 120, type: WallType.EXTERIOR } // 东
  ],

  obstacles: [],
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
  status: "idle" | "walking" | "talking" | "seeking";
  color: string;
  avatar: string;
  // 历史对话
  // history: string;
  // 沉淀的知识
  // memory: string;
  // 用户背景
  bg?: string;
  talkingWith?: number; // 正在与哪个agent交谈
}

// 任务接口
export interface AgentTask {
  agentId: number;
  task: {
    type: "move" | "talk" | "seek";
    to?: { x: number; y: number };
    targetAgentId?: number;
    duration?: number; // 如果是talk任务，可以指定谈话持续时间
  };
}

// 初始agent数据
export const INITIAL_AGENTS: Agent[] = [
  { id: 1, name: "张三", x: 5, y: 5, color: "#FF5733", moving: false },
  { id: 2, name: "李四", x: 15, y: 10, color: "#33A1FF", moving: false },
  { id: 3, name: "王五", x: 8, y: 18, color: "#33FF57", moving: false },
];
