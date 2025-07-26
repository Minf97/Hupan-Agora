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
    {
      id: "hall",
      name: "大厅",
      type: RoomType.LOBBY,
      x: 400,
      y: 300,
      width: 400,
      height: 300,
      color: "#f5f5f5",
      description: "中央大厅，连接各个房间",
      capacity: 8,
      spawnPoints: [
        { x: 450, y: 350 },
        { x: 550, y: 350 },
        { x: 500, y: 400 },
        { x: 600, y: 400 },
      ],
    },
    {
      id: "room-a",
      name: "房间 A",
      type: RoomType.OFFICE,
      x: 100,
      y: 300,
      width: 200,
      height: 220,
      color: "#e3f2fd",
      description: "左侧房间",
      capacity: 3,
      spawnPoints: [
        { x: 120, y: 320 },
        { x: 150, y: 360 },
      ],
    },
    {
      id: "room-d",
      name: "房间 D",
      type: RoomType.CAFE,
      x: 700,
      y: 100,
      width: 180,
      height: 120,
      color: "#fff8e1",
      description: "顶端房间，右上角",
      capacity: 3,
      spawnPoints: [
        { x: 730, y: 130 },
        { x: 760, y: 140 },
      ],
    },
    {
      id: "room-f",
      name: "房间 F",
      type: RoomType.OFFICE,
      x: 700,
      y: 700,
      width: 180,
      height: 120,
      color: "#e8f5e9",
      description: "底部房间，靠右",
      capacity: 3,
      spawnPoints: [
        { x: 730, y: 730 },
        { x: 760, y: 760 },
      ],
    },
  ],

  doors: [
    {
      x: 300,
      y: 380,
      width: 5,
      height: 40,
      connects: ["room-a", "hall"],
      isOpen: true,
    },
    {
      x: 750,
      y: 220,
      width: 5,
      height: 40,
      connects: ["room-d", "hall"],
      isOpen: true,
    },
    {
      x: 750,
      y: 600,
      width: 5,
      height: 40,
      connects: ["room-f", "hall"],
      isOpen: true,
    },
  ],

  walls: [
    // Room A (left middle)
    { x: 100, y: 300, width: 200, height: 5, type: WallType.EXTERIOR }, // North
    { x: 100, y: 300, width: 5, height: 220, type: WallType.EXTERIOR }, // West
    { x: 295, y: 300, width: 5, height: 220, type: WallType.EXTERIOR }, // East
    { x: 100, y: 520, width: 200, height: 5, type: WallType.EXTERIOR }, // South

    // Room D (top right)
    { x: 700, y: 100, width: 180, height: 5, type: WallType.EXTERIOR }, // North
    { x: 700, y: 100, width: 5, height: 120, type: WallType.EXTERIOR }, // West
    { x: 875, y: 100, width: 5, height: 120, type: WallType.EXTERIOR }, // East
    { x: 700, y: 220, width: 180, height: 5, type: WallType.EXTERIOR }, // South

    // Room F (bottom right)
    { x: 700, y: 700, width: 180, height: 5, type: WallType.EXTERIOR }, // North
    { x: 700, y: 700, width: 5, height: 120, type: WallType.EXTERIOR }, // West
    { x: 875, y: 700, width: 5, height: 120, type: WallType.EXTERIOR }, // East
    { x: 700, y: 820, width: 180, height: 5, type: WallType.EXTERIOR }, // South

    // Hall 中央大厅（室内结构，偏内墙）
    { x: 400, y: 300, width: 400, height: 5, type: WallType.INTERIOR }, // North
    { x: 400, y: 595, width: 400, height: 5, type: WallType.INTERIOR }, // South
    { x: 400, y: 300, width: 5, height: 295, type: WallType.INTERIOR }, // West
    { x: 795, y: 300, width: 5, height: 295, type: WallType.INTERIOR }, // East
  ],

  obstacles: [], // 当前未标记
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
