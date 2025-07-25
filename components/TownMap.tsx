"use client";

import { useRef, useEffect, useState } from "react";
import { Stage, Layer, Rect, Circle, Text, Group, Ring } from "react-konva";
import Konva from "konva";
import { MAP_CONFIG, Room, Wall, Door, WallType, RoomType } from "@/lib/map-config";
import { useSocketManager } from "@/hooks/useSocketManager";
import { ThoughtPanel } from "@/components/ThoughtPanel";
import { MemoryPanel } from "@/components/MemoryPanel";
import { AgentInfoPanel } from "@/components/AgentInfoPanel";

export default function TownMap() {
  const stageRef = useRef<Konva.Stage | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [draggingAgentId, setDraggingAgentId] = useState<number | null>(null);
  
  const {
    socket,
    connectionStatus,
    townTime,
    realTimeSeconds,
    agents,
    agentCirclesRef,
    agentTextsRef,
    activeConversations,
    conversationMessages,
    thoughtLogger,
    setAgents
  } = useSocketManager();

  // 保留最新20条消息
  const latestMessages = conversationMessages.slice(-20);

  // 处理代理点击事件
  const handleAgentClick = (agentId: number) => {
    setSelectedAgentId(agentId);
  };

  // 关闭代理信息面板
  const handleCloseAgentInfo = () => {
    setSelectedAgentId(null);
  };

  // 检查位置是否在障碍物内部 (enhanced with wall system)
  const isPointInObstacle = (x: number, y: number): boolean => {
    // Check legacy obstacles
    const inLegacyObstacle = MAP_CONFIG.obstacles.some(obstacle =>
      x >= obstacle.x && x <= obstacle.x + obstacle.width &&
      y >= obstacle.y && y <= obstacle.y + obstacle.height
    );
    
    // Check walls (but not doors)
    const inWall = MAP_CONFIG.walls.some(wall =>
      x >= wall.x && x <= wall.x + wall.width &&
      y >= wall.y && y <= wall.y + wall.height
    );
    
    // Check if point is in a door opening (doors allow passage)
    const inDoor = MAP_CONFIG.doors.some(door =>
      door.isOpen &&
      x >= door.x && x <= door.x + door.width &&
      y >= door.y && y <= door.y + door.height
    );
    
    return (inLegacyObstacle || inWall) && !inDoor;
  };
  
  // Get room at position
  const getRoomAtPosition = (x: number, y: number): Room | null => {
    return MAP_CONFIG.rooms.find(room =>
      x >= room.x && x <= room.x + room.width &&
      y >= room.y && y <= room.y + room.height
    ) || null;
  };

  // 检查位置是否在地图边界内
  const isPointInBounds = (x: number, y: number): boolean => {
    const margin = 15; // 给agent留一些边距
    return x >= margin && x <= MAP_CONFIG.width - margin &&
           y >= margin && y <= MAP_CONFIG.height - margin;
  };

  // 获取有效的拖拽位置
  const getValidDragPosition = (x: number, y: number): { x: number; y: number } => {
    // 首先检查边界
    const margin = 15;
    let validX = Math.max(margin, Math.min(MAP_CONFIG.width - margin, x));
    let validY = Math.max(margin, Math.min(MAP_CONFIG.height - margin, y));
    
    // 检查是否在障碍物内部
    if (isPointInObstacle(validX, validY)) {
      // 如果在障碍物内部，尝试找到最近的有效位置
      const originalX = validX;
      const originalY = validY;
      let found = false;
      
      // 在周围搜索有效位置
      for (let radius = 20; radius <= 60 && !found; radius += 10) {
        for (let angle = 0; angle < 360; angle += 30) {
          const testX = originalX + radius * Math.cos(angle * Math.PI / 180);
          const testY = originalY + radius * Math.sin(angle * Math.PI / 180);
          
          if (isPointInBounds(testX, testY) && !isPointInObstacle(testX, testY)) {
            validX = testX;
            validY = testY;
            found = true;
            break;
          }
        }
      }
    }
    
    return { x: validX, y: validY };
  };

  // 拖拽节流状态
  const dragThrottleRef = useRef<{ [key: number]: NodeJS.Timeout | null }>({});
  
  // 处理agent拖拽开始
  const handleAgentDragStart = (agentId: number) => {
    console.log(`📄 开始拖拽 Agent ${agentId}`);
    setDraggingAgentId(agentId);
    
    // 清除之前的节流定时器
    if (dragThrottleRef.current[agentId]) {
      clearTimeout(dragThrottleRef.current[agentId]!);
      dragThrottleRef.current[agentId] = null;
    }
    
    // 通知服务器拖拽开始（可选）
    if (socket) {
      socket.emit('agentUpdate', {
        agentId,
        status: 'busy', // 标记为忙碌状态，防止任务分配
        position: agents.find(a => a.id === agentId)?.position
      });
    }
  };

  // 处理agent拖拽中
  const handleAgentDragMove = (agentId: number, newPos: { x: number; y: number }) => {
    const validPos = getValidDragPosition(newPos.x, newPos.y);
    
    // 节流更新服务器位置（每200ms最多一次）
    if (dragThrottleRef.current[agentId]) {
      clearTimeout(dragThrottleRef.current[agentId]!);
    }
    
    dragThrottleRef.current[agentId] = setTimeout(() => {
      if (socket && draggingAgentId === agentId) {
        socket.emit('agentUpdate', {
          agentId,
          status: 'busy',
          position: validPos
        });
      }
    }, 200);
    
    // 同步更新文本位置
    const agentText = agentTextsRef.current[agentId];
    if (agentText) {
      agentText.x(validPos.x - 25);
      agentText.y(validPos.y - 35);
    }
    
    return validPos;
  };

  // 处理agent拖拽结束
  const handleAgentDragEnd = (agentId: number, finalPos: { x: number; y: number }) => {
    const validPos = getValidDragPosition(finalPos.x, finalPos.y);
    console.log(`🏁 Agent ${agentId} 拖拽结束，位置: (${Math.round(validPos.x)}, ${Math.round(validPos.y)})`);
    
    setDraggingAgentId(null);
    
    // 清除节流定时器
    if (dragThrottleRef.current[agentId]) {
      clearTimeout(dragThrottleRef.current[agentId]!);
      dragThrottleRef.current[agentId] = null;
    }
    
    // 立即发送最终位置到服务器
    if (socket) {
      socket.emit('agentUpdate', {
        agentId,
        status: 'idle', // 恢复为空闲状态
        position: validPos
      });
    }
    
    // 更新本地agent状态
    setAgents((prev) => 
      prev.map((agent) => 
        agent.id === agentId 
          ? { ...agent, position: validPos }
          : agent
      )
    );
    
    return validPos;
  };
  
  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      Object.values(dragThrottleRef.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  return (
    <div className="relative rounded-lg overflow-hidden border">
      {/* 连接状态显示 */}
      <div className="absolute top-2 left-2 bg-card p-2 rounded-md shadow-sm z-10">
        <div
          className={`text-xs ${
            connectionStatus === "已连接" ? "text-green-500" : "text-amber-500"
          }`}
        >
          {connectionStatus}
        </div>
      </div>

      {/* 小镇时间显示 */}
      <div className="absolute top-2 right-2 bg-card p-2 rounded-md shadow-sm z-10">
        <div className="text-sm font-semibold">
          小镇时间: {townTime.hour.toString().padStart(2, "0")}:
          {townTime.minute.toString().padStart(2, "0")}
        </div>
        <div className="text-xs text-muted-foreground">
          现实时间: {Math.floor(realTimeSeconds / 60)}分{realTimeSeconds % 60}秒
        </div>
      </div>

      {/* 活跃对话显示 */}
      <div className="absolute top-14 left-2 bg-card p-2 rounded-md shadow-sm z-10 max-w-[200px]">
        <div className="text-xs font-medium text-yellow-800">
          进行中的对话: {activeConversations.size}
        </div>
        {Array.from(activeConversations.values()).map((conv: any, index: number) => (
          <div key={index} className="text-xs text-yellow-700">
            {conv.agent1Name} ↔ {conv.agent2Name}
          </div>
        ))}
      </div>

      {/* 对话消息面板 */}
      <div className="absolute bottom-2 right-2 bg-card p-2 rounded-md shadow-sm z-10 max-w-[300px] max-h-[200px] overflow-y-auto">
        {latestMessages.map((msg, index) => (
          <div key={index} className="text-xs">
            <span className="font-medium text-blue-600">{msg.speaker}:</span>
            <span className="ml-1 text-muted-foreground">{msg.content}</span>
          </div>
        ))}
      </div>

      {/* 思考记录面板 */}
      <div className="absolute bottom-2 left-2 z-10">
        <ThoughtPanel 
          thoughts={thoughtLogger.thoughts} 
          onClear={thoughtLogger.clearThoughts}
          isLoading={thoughtLogger.isLoading}
          onRefresh={thoughtLogger.refreshThoughts}
        />
      </div>

      {/* 记忆面板 */}
      <div className="absolute bottom-2 left-[22rem] z-10">
        <MemoryPanel 
          agentId={agents.length > 0 ? agents[0].id : undefined}
        />
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
          {Array.from({
            length: Math.ceil(MAP_CONFIG.width / MAP_CONFIG.gridSize),
          }).map((_, i) => (
            <Rect
              key={`vline-${i}`}
              x={i * MAP_CONFIG.gridSize}
              y={0}
              width={1}
              height={MAP_CONFIG.height}
              fill="#e0e0e0"
            />
          ))}
          {Array.from({
            length: Math.ceil(MAP_CONFIG.height / MAP_CONFIG.gridSize),
          }).map((_, i) => (
            <Rect
              key={`hline-${i}`}
              x={0}
              y={i * MAP_CONFIG.gridSize}
              width={MAP_CONFIG.width}
              height={1}
              fill="#e0e0e0"
            />
          ))}

          {/* Room backgrounds */}
          {MAP_CONFIG.rooms.map((room) => (
            <Group key={`room-${room.id}`}>
              <Rect
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                fill={room.color}
                stroke="#d0d0d0"
                strokeWidth={1}
                cornerRadius={2}
                opacity={0.3}
              />
              <Text
                text={room.name}
                x={room.x + 10}
                y={room.y + 10}
                fontSize={12}
                fill="#666"
                fontStyle="bold"
              />
            </Group>
          ))}

          {/* Walls */}
          {MAP_CONFIG.walls.map((wall, index) => (
            <Rect
              key={`wall-${index}`}
              x={wall.x}
              y={wall.y}
              width={wall.width}
              height={wall.height}
              fill={wall.type === WallType.EXTERIOR ? "#34495e" : "#7f8c8d"}
              stroke={wall.type === WallType.EXTERIOR ? "#2c3e50" : "#95a5a6"}
              strokeWidth={1}
              cornerRadius={1}
            />
          ))}

          {/* Doors (openings) */}
          {MAP_CONFIG.doors.map((door, index) => (
            <Rect
              key={`door-${index}`}
              x={door.x}
              y={door.y}
              width={door.width}
              height={door.height}
              fill={door.isOpen ? "transparent" : "#8B4513"}
              stroke={door.isOpen ? "#2ECC71" : "#A0522D"}
              strokeWidth={door.isOpen ? 2 : 1}
              dash={door.isOpen ? [5, 5] : []}
              cornerRadius={2}
            />
          ))}

          {/* Legacy obstacles (for backward compatibility) */}
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
          {agents.map((agent) => (
            <Group key={`agent-${agent.id}`}>
              {/* 对话状态外环 */}
              {agent.status === "talking" && (
                <Ring
                  x={agent.position.x}
                  y={agent.position.y}
                  innerRadius={12}
                  outerRadius={16}
                  fill="transparent"
                  stroke="#FFD700"
                  strokeWidth={2}
                />
              )}
              
              <Circle
                ref={(node) => {
                  if (node) agentCirclesRef.current[agent.id] = node;
                }}
                x={agent.position.x}
                y={agent.position.y}
                radius={10}
                fill={agent.color}
                shadowColor="black"
                shadowBlur={agent.status === "walking" ? 4 : 0}
                shadowOpacity={agent.status === "walking" ? 0.4 : 0}
                // 添加移动动效
                shadowOffsetX={agent.status === "walking" ? 1 : 0}
                shadowOffsetY={agent.status === "walking" ? 1 : 0}
                // 对话状态效果和拖拽状态效果
                stroke={
                  agent.status === "talking" ? "#FFD700" : 
                  draggingAgentId === agent.id ? "#4CAF50" : "transparent"
                }
                strokeWidth={
                  agent.status === "talking" || draggingAgentId === agent.id ? 2 : 0
                }
                scale={
                  agent.status === "talking" ? { x: 1.2, y: 1.2 } :
                  draggingAgentId === agent.id ? { x: 1.1, y: 1.1 } : { x: 1, y: 1 }
                }
                // 添加点击事件
                onClick={() => handleAgentClick(agent.id)}
                onTap={() => handleAgentClick(agent.id)}
                // 鼠标悬停效果
                onMouseEnter={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container && agent.status !== 'talking') {
                    container.style.cursor = 'grab';
                  }
                }}
                onMouseLeave={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) {
                    container.style.cursor = 'default';
                  }
                }}
                // 拖拽功能（只有空闲状态的agent可以拖拽）
                draggable={agent.status === 'idle'}
                onDragStart={() => {
                  handleAgentDragStart(agent.id);
                  // 改变鼠标样式
                  const container = stageRef.current?.container();
                  if (container) {
                    container.style.cursor = 'grabbing';
                  }
                }}
                onDragMove={(e) => {
                  const newPos = { x: e.target.x(), y: e.target.y() };
                  const validPos = handleAgentDragMove(agent.id, newPos);
                  
                  // 设置有效位置
                  e.target.x(validPos.x);
                  e.target.y(validPos.y);
                }}
                onDragEnd={(e) => {
                  const finalPos = { x: e.target.x(), y: e.target.y() };
                  const validPos = handleAgentDragEnd(agent.id, finalPos);
                  
                  // 确保最终位置有效
                  e.target.x(validPos.x);
                  e.target.y(validPos.y);
                  
                  // 恢复鼠标样式
                  const container = stageRef.current?.container();
                  if (container) {
                    container.style.cursor = 'grab';
                  }
                }}
              />
              <Text
                ref={(node) => {
                  if (node) agentTextsRef.current[agent.id] = node;
                }}
                text={`${agent.name} ${agent.status === "talking" ? "💬" : ""}`}
                x={agent.position.x - 25}
                y={agent.position.y - 35}
                fontSize={10}
                fill="#333"
                align="center"
                width={50}
              />
            </Group>
          ))}
        </Layer>
      </Stage>

      {/* 代理信息面板 */}
      {selectedAgentId && (
        <AgentInfoPanel
          agentId={selectedAgentId}
          onClose={handleCloseAgentInfo}
          activeConversations={activeConversations}
          conversationMessages={conversationMessages}
        />
      )}
    </div>
  );
}
