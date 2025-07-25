"use client";

import { useRef, useEffect } from "react";
import { Stage, Layer, Rect, Circle, Text, Group, Ring } from "react-konva";
import Konva from "konva";
import { MAP_CONFIG } from "@/lib/map-config";
import { useSocketManager } from "@/hooks/useSocketManager";
import { ThoughtPanel } from "@/components/ThoughtPanel";

export default function TownMap() {
  const stageRef = useRef<Konva.Stage | null>(null);
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
    thoughtLogger
  } = useSocketManager();

  // 保留最新20条消息
  const latestMessages = conversationMessages.slice(-20);

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
                // 对话状态效果
                stroke={agent.status === "talking" ? "#FFD700" : "transparent"}
                strokeWidth={agent.status === "talking" ? 2 : 0}
                scale={agent.status === "talking" ? { x: 1.2, y: 1.2 } : { x: 1, y: 1 }}
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
    </div>
  );
}
