"use client";

import { useEffect, useState, useRef } from "react";
import { Stage, Layer, Rect, Circle, Text, Group } from "react-konva";
import { Socket, io } from "socket.io-client";
import Konva from "konva";
import PF from "pathfinding";
import { MAP_CONFIG, Agent } from "@/lib/map-config";

// 将坐标转换为网格坐标
const toGridCoords = (x: number, y: number) => ({
  gridX: Math.floor(x / MAP_CONFIG.gridSize),
  gridY: Math.floor(y / MAP_CONFIG.gridSize),
});

export default function TownMap() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [townTime, setTownTime] = useState({ hour: 8, minute: 0 });
  const [realTimeSeconds, setRealTimeSeconds] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("正在连接...");
  const stageRef = useRef<Konva.Stage | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const animationsRef = useRef<{ [key: number]: Konva.Animation }>({});
  
  // 引用每个agent的circle节点，用于动画
  const agentCirclesRef = useRef<{ [key: number]: Konva.Circle }>({});
  const agentTextsRef = useRef<{ [key: number]: Konva.Text }>({});
  
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
  
  // 连接WebSocket
  useEffect(() => {
    // 获取WebSocket服务器地址
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    
    console.log("正在连接到WebSocket:", wsUrl);
    
    // 创建WebSocket连接
    const socket = io(wsUrl, {
      transports: ['websocket', 'polling'], // 优先使用WebSocket，备选轮询
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });
    
    socketRef.current = socket;
    
    // 监听连接事件
    socket.on('connect', () => {
      console.log("WebSocket连接成功");
      setConnectionStatus("已连接");
    });
    
    socket.on('connect_error', (err) => {
      console.error("WebSocket连接错误:", err);
      setConnectionStatus(`连接错误: ${err.message}`);
    });
    
    // 接收初始数据
    socket.on('init', (data) => {
      console.log("收到初始数据:", data);
      setAgents(data.agents);
      setTownTime(data.townTime);
    });
    
    // 接收时间更新
    socket.on('timeUpdate', (newTime) => {
      setTownTime(newTime);
      setRealTimeSeconds(prev => prev + 1);
    });
    
    // 接收agent位置更新
    socket.on('agentsUpdate', (updatedAgents) => {
      console.log("收到agent位置更新:", updatedAgents);
      
      setAgents(prevAgents => {
        // 对每个agent应用平滑动画
        updatedAgents.forEach((updatedAgent: Agent) => {
          const prevAgent = prevAgents.find(a => a.id === updatedAgent.id);
          if (prevAgent) {
            animateAgentMovement(prevAgent, updatedAgent);
          }
        });
        return updatedAgents;
      });
    });
    
    // 清理函数
    return () => {
      Object.values(animationsRef.current).forEach(animation => animation.stop());
      socket.disconnect();
    };
  }, []);
  
  // 应用平滑动画
  const animateAgentMovement = (prevAgent: Agent, updatedAgent: Agent) => {
    const agentCircle = agentCirclesRef.current[updatedAgent.id];
    const agentText = agentTextsRef.current[updatedAgent.id];
    
    if (!agentCircle || !agentText) return;
    
    // 如果位置没有变化，不需要动画
    if (prevAgent.x === updatedAgent.x && prevAgent.y === updatedAgent.y) return;
    
    // 如果已存在该agent的动画，先停止
    if (animationsRef.current[updatedAgent.id]) {
      animationsRef.current[updatedAgent.id].stop();
    }
    
    // 计算移动距离
    const distanceX = updatedAgent.x - prevAgent.x;
    const distanceY = updatedAgent.y - prevAgent.y;
    const totalDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    
    // 设定移动速度（像素/秒）
    const moveSpeed = 50; // 可以调整此值以改变移动速度
    
    // 根据距离和速度计算动画持续时间（毫秒）
    const duration = (totalDistance / moveSpeed) * 1000;
    
    // 创建新动画
    const animation = new Konva.Animation((frame) => {
      if (!frame) return;
      
      const elapsedTime = frame.time;
      const progress = Math.min(elapsedTime / duration, 1);
      
      // 计算插值位置
      const newX = prevAgent.x + distanceX * progress;
      const newY = prevAgent.y + distanceY * progress;
      
      // 更新位置
      agentCircle.x(newX);
      agentCircle.y(newY);
      agentText.x(newX - 15);
      agentText.y(newY - 25);
      
      // 如果动画完成，停止
      if (progress >= 1) {
        animation.stop();
        delete animationsRef.current[updatedAgent.id];
      }
    }, agentCircle.getLayer());
    
    // 存储动画引用并启动
    animationsRef.current[updatedAgent.id] = animation;
    animation.start();
  };

  return (
    <div className="relative rounded-lg overflow-hidden border">
      {/* 连接状态显示 */}
      <div className="absolute top-2 left-2 bg-card p-2 rounded-md shadow-sm z-10">
        <div className={`text-xs ${connectionStatus === "已连接" ? "text-green-500" : "text-amber-500"}`}>
          {connectionStatus}
        </div>
      </div>
      
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
                ref={node => {
                  if (node) agentCirclesRef.current[agent.id] = node;
                }}
                x={agent.x} 
                y={agent.y} 
                radius={10} 
                fill={agent.color}
                shadowColor="black"
                shadowBlur={agent.moving ? 4 : 0}
                shadowOpacity={agent.moving ? 0.4 : 0}
                // 添加移动动效
                shadowOffsetX={agent.moving ? 1 : 0}
                shadowOffsetY={agent.moving ? 1 : 0}
              />
              <Text
                ref={node => {
                  if (node) agentTextsRef.current[agent.id] = node;
                }}
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