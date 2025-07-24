"use client";

import { useRef } from "react";
import { Stage, Layer, Rect, Circle, Text, Group } from "react-konva";
import Konva from "konva";
import PF from "pathfinding";
import { MAP_CONFIG } from "@/lib/map-config";
import { useSocketManager } from "@/hooks/useSocketManager";

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
  } = useSocketManager();

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
              />
              <Text
                ref={(node) => {
                  if (node) agentTextsRef.current[agent.id] = node;
                }}
                text={`${agent.name} (${agent.status})`}
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
