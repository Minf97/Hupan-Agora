"use client";

import { useEffect, useState, useRef } from "react";
import { Stage, Layer, Rect, Circle, Text, Group } from "react-konva";
import PF from "pathfinding";

// 地图配置
const MAP_CONFIG = {
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

// 定义Agent类型
interface Agent {
  id: number;
  name: string;
  x: number;
  y: number;
  color: string;
  target: { x: number; y: number };
  path?: { x: number; y: number }[];
  pathIndex?: number;
}

// 模拟数字人
const INITIAL_AGENTS: Agent[] = [
  { id: 1, name: "张三", x: 50, y: 50, color: "#e74c3c", target: { x: 600, y: 400 } },
  { id: 2, name: "李四", x: 700, y: 50, color: "#3498db", target: { x: 150, y: 350 } },
  { id: 3, name: "王五", x: 400, y: 400, color: "#2ecc71", target: { x: 700, y: 300 } }
];

// 将坐标转换为网格坐标
const toGridCoords = (x: number, y: number) => ({
  gridX: Math.floor(x / MAP_CONFIG.gridSize),
  gridY: Math.floor(y / MAP_CONFIG.gridSize),
});

export default function TownMap() {
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [townTime, setTownTime] = useState({ hour: 8, minute: 0 });
  const [realTimeSeconds, setRealTimeSeconds] = useState(0);
  const stageRef = useRef(null);
  
  // 创建寻路网格
  const gridRef = useRef(createGrid());
  
  function createGrid() {
    // 创建网格
    const gridWidth = Math.ceil(MAP_CONFIG.width / MAP_CONFIG.gridSize);
    const gridHeight = Math.ceil(MAP_CONFIG.height / MAP_CONFIG.gridSize);
    const grid = new PF.Grid(gridWidth, gridHeight);
    
    // 标记障碍物
    MAP_CONFIG.obstacles.forEach(obstacle => {
      const startX = Math.floor(obstacle.x / MAP_CONFIG.gridSize);
      const startY = Math.floor(obstacle.y / MAP_CONFIG.gridSize);
      const endX = Math.ceil((obstacle.x + obstacle.width) / MAP_CONFIG.gridSize);
      const endY = Math.ceil((obstacle.y + obstacle.height) / MAP_CONFIG.gridSize);
      
      for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
          if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
            grid.setWalkableAt(x, y, false);
          }
        }
      }
    });
    
    return grid;
  }
  
  // 寻找路径
  function findPath(startX: number, startY: number, endX: number, endY: number) {
    const { gridX: sX, gridY: sY } = toGridCoords(startX, startY);
    const { gridX: eX, gridY: eY } = toGridCoords(endX, endY);
    
    // 克隆网格以避免修改原始网格
    const gridClone = gridRef.current.clone();
    const finder = new PF.AStarFinder({
      allowDiagonal: true,
      dontCrossCorners: true
    });
    
    try {
      const path = finder.findPath(sX, sY, eX, eY, gridClone);
      return path.map((point: number[]) => ({
        x: point[0] * MAP_CONFIG.gridSize + MAP_CONFIG.gridSize / 2,
        y: point[1] * MAP_CONFIG.gridSize + MAP_CONFIG.gridSize / 2
      }));
    } catch (e) {
      console.error("路径查找失败:", e);
      return [];
    }
  }

  // 更新小镇时间
  useEffect(() => {
    const timer = setInterval(() => {
      setRealTimeSeconds(prev => prev + 1);
      
      // 现实1秒 = 小镇1分钟
      setTownTime(prev => {
        const newMinute = prev.minute + 1;
        if (newMinute >= 60) {
          return {
            hour: (prev.hour + 1) % 24,
            minute: 0
          };
        }
        return {
          hour: prev.hour,
          minute: newMinute
        };
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // 更新数字人位置
  useEffect(() => {
    const moveAgents = () => {
      setAgents(prevAgents => 
        prevAgents.map(agent => {
          // 如果没有路径或已到达目标，则生成新路径
          if (!agent.path || agent.pathIndex === undefined || agent.pathIndex >= agent.path.length) {
            // 随机生成新目标点
            const randomTarget = {
              x: Math.floor(Math.random() * MAP_CONFIG.width),
              y: Math.floor(Math.random() * MAP_CONFIG.height)
            };
            
            // 避免目标点在障碍物内
            let validTarget = true;
            for (const obstacle of MAP_CONFIG.obstacles) {
              if (
                randomTarget.x >= obstacle.x && 
                randomTarget.x <= obstacle.x + obstacle.width && 
                randomTarget.y >= obstacle.y && 
                randomTarget.y <= obstacle.y + obstacle.height
              ) {
                validTarget = false;
                break;
              }
            }
            
            // 如果目标有效，则寻找路径
            if (validTarget) {
              const path = findPath(agent.x, agent.y, randomTarget.x, randomTarget.y);
              return {
                ...agent,
                target: randomTarget,
                path: path,
                pathIndex: 0
              };
            }
            return agent;
          }
          
          // 沿着路径移动
          if (agent.path && agent.pathIndex !== undefined && agent.pathIndex < agent.path.length) {
            const nextPos = agent.path[agent.pathIndex];
            return {
              ...agent,
              x: nextPos.x,
              y: nextPos.y,
              pathIndex: agent.pathIndex + 1
            };
          }
          
          return agent;
        })
      );
    };
    
    // 每200毫秒更新一次位置
    const interval = setInterval(moveAgents, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative rounded-lg overflow-hidden border">
      {/* 小镇时间显示 */}
      <div className="absolute top-2 right-2 bg-card p-2 rounded-md shadow-sm z-10">
        <div className="text-sm font-semibold">
          小镇时间: {townTime.hour.toString().padStart(2, '0')}:{townTime.minute.toString().padStart(2, '0')}
        </div>
        <div className="text-xs text-muted-foreground">
          现实时间: {Math.floor(realTimeSeconds / 60)}分{realTimeSeconds % 60}秒
        </div>
      </div>
      
      {/* 地图画布 */}
      <Stage width={MAP_CONFIG.width} height={MAP_CONFIG.height} ref={stageRef}>
        <Layer>
          {/* 背景 */}
          <Rect 
            x={0} 
            y={0} 
            width={MAP_CONFIG.width} 
            height={MAP_CONFIG.height} 
            fill="#f9f9f9" 
          />
          
          {/* 网格线 */}
          {Array.from({ length: Math.ceil(MAP_CONFIG.width / MAP_CONFIG.gridSize) }).map((_, i) => (
            <Rect
              key={`vline-${i}`}
              x={i * MAP_CONFIG.gridSize}
              y={0}
              width={1}
              height={MAP_CONFIG.height}
              fill="#e0e0e0"
            />
          ))}
          {Array.from({ length: Math.ceil(MAP_CONFIG.height / MAP_CONFIG.gridSize) }).map((_, i) => (
            <Rect
              key={`hline-${i}`}
              x={0}
              y={i * MAP_CONFIG.gridSize}
              width={MAP_CONFIG.width}
              height={1}
              fill="#e0e0e0"
            />
          ))}
          
          {/* 障碍物 (建筑物) */}
          {MAP_CONFIG.obstacles.map((obstacle, index) => (
            <Rect
              key={`obstacle-${index}`}
              x={obstacle.x}
              y={obstacle.y}
              width={obstacle.width}
              height={obstacle.height}
              fill="#95a5a6"
              stroke="#7f8c8d"
              strokeWidth={1}
              cornerRadius={4}
            />
          ))}
          
          {/* 数字人 */}
          {agents.map(agent => (
            <Group key={`agent-${agent.id}`}>
              <Circle 
                x={agent.x} 
                y={agent.y} 
                radius={10} 
                fill={agent.color} 
              />
              <Text
                text={agent.name}
                x={agent.x - 15}
                y={agent.y - 25}
                fontSize={12}
                fill="#333"
                align="center"
                width={30}
              />
            </Group>
          ))}
        </Layer>
      </Stage>
    </div>
  );
} 