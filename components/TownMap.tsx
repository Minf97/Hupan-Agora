"use client";

import { useRef, useEffect, useState } from "react";
import { Stage, Layer, Rect, Circle, Text, Group, Ring } from "react-konva";
import Konva from "konva";
import { MAP_CONFIG, Room, WallType } from "@/lib/map-config";
import { useSocketManager } from "@/hooks/useSocketManager";
import { activityLogService, ActivityLogWithId } from "@/lib/activity-logs";
import AgentDetailSidebar from "@/components/AgentDetailSidebar";

// 导入 ThoughtRecord 类型
import Image from "next/image";

interface ThoughtRecord {
  id: string;
  timestamp: number;
  agentId: number;
  agentName: string;
  type: "inner_thought" | "decision" | "conversation";
  content: string;
  metadata?: {
    confidence?: number;
    reasoning?: string;
    shouldInitiateChat?: boolean;
    emotion?: string;
    conversationId?: string;
  };
}

// 日志记录类型（保持向后兼容）
interface LogEntry {
  id: string;
  timestamp: number;
  type:
    | "status_change"
    | "conversation_start"
    | "conversation_message"
    | "conversation_end";
  agentId: number;
  agentName: string;
  content: string;
  metadata?: {
    fromStatus?: string;
    toStatus?: string;
    targetAgentId?: number;
    targetAgentName?: string;
    conversationId?: string;
  };
}

// 对话波纹动效组件
interface ConversationRippleProps {
  x: number;
  y: number;
  isVisible: boolean;
  layer?: Konva.Layer | null;
}

const ConversationRipple: React.FC<ConversationRippleProps> = ({
  x,
  y,
  isVisible,
  layer,
}) => {
  const [ripples, setRipples] = useState<
    Array<{ id: string; radius: number; opacity: number }>
  >([]);
  const animationRef = useRef<Konva.Animation | null>(null);
  const rippleIdCounter = useRef(0);

  useEffect(() => {
    if (!isVisible || !layer) {
      // 停止动画并清除波纹
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      setRipples([]);
      return;
    }

    // 创建波纹动画
    const createNewRipple = () => {
      const newRipple = {
        id: `ripple-${rippleIdCounter.current++}`,
        radius: 15,
        opacity: 0.6,
      };

      setRipples((prev) => [...prev, newRipple]);
    };

    // 启动动画
    const animation = new Konva.Animation((frame) => {
      if (!frame) return;

      setRipples((prev) => {
        return prev
          .map((ripple) => ({
            ...ripple,
            radius: ripple.radius + 0.8, // 波纹扩散速度
            opacity: Math.max(0, ripple.opacity - 0.008), // 透明度衰减
          }))
          .filter((ripple) => ripple.opacity > 0 && ripple.radius < 40); // 移除完全透明或过大的波纹
      });
    }, layer);

    animationRef.current = animation;
    animation.start();

    // 定期创建新波纹
    const rippleInterval = setInterval(createNewRipple, 800);

    // 立即创建第一个波纹
    createNewRipple();

    return () => {
      if (animation) {
        animation.stop();
      }
      clearInterval(rippleInterval);
    };
  }, [isVisible, layer, x, y]);

  if (!isVisible) return null;

  return (
    <>
      {ripples.map((ripple) => (
        <Ring
          key={ripple.id}
          x={x}
          y={y}
          innerRadius={Math.max(0, ripple.radius - 3)}
          outerRadius={ripple.radius}
          fill="rgba(255, 215, 0, 0.3)"
          stroke="#FFD700"
          strokeWidth={1}
          opacity={ripple.opacity}
        />
      ))}
    </>
  );
};

export default function TownMap() {
  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [draggingAgentId, setDraggingAgentId] = useState<number | null>(null);

  // 添加 thoughts 状态
  const [recentThoughts, setRecentThoughts] = useState<ThoughtRecord[]>([]);
  const [isLoadingThoughts, setIsLoadingThoughts] = useState(false);

  // 日志状态管理
  const [logs, setLogs] = useState<ActivityLogWithId[]>([]);

  // 从数据库加载日志
  const loadLogs = async () => {
    try {
      const dbLogs = await activityLogService.getLogs({ limit: 100 });
      setLogs(dbLogs);
    } catch (error) {
      console.error("加载日志失败:", error);
    }
  };

  // 添加日志记录函数（现在保存到数据库）
  const addLog = async (entry: {
    type: "conversation_start" | "conversation_end";
    agentId: number;
    agentName: string;
    content: string;
    targetAgentId?: number;
    targetAgentName?: string;
    conversationId?: string;
  }) => {
    try {
      const newLog = await activityLogService.createLog({
        type: entry.type,
        agentId: entry.agentId,
        agentName: entry.agentName,
        content: entry.content,
        targetAgentId: entry.targetAgentId,
        targetAgentName: entry.targetAgentName,
        metadata: entry.conversationId
          ? { conversationId: entry.conversationId }
          : undefined,
      });

      // 更新本地状态，保持最新的100条记录
      setLogs((prev) => [newLog, ...prev].slice(0, 100));
    } catch (error) {
      console.error("保存日志失败:", error);
    }
  };

  // 组件挂载时加载日志
  useEffect(() => {
    loadLogs();
  }, []);

  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({
    width: MAP_CONFIG.width,
    height: MAP_CONFIG.height,
  });
  const SCALE_BY = 1.02;
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3;

  const {
    socket,
    connectionStatus,
    townTime,
    realTimeSeconds,
    agents,
    agentCirclesRef,
    agentTextsRef,
    stopAgentAnimation,
    activeConversations,
    thoughtLogger,
    setAgents,
  } = useSocketManager();

  // 监听agents状态变化并记录日志（只记录交谈相关状态）
  const prevAgentsRef = useRef<typeof agents>([]);
  const recordedConversationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (prevAgentsRef.current.length === 0) {
      prevAgentsRef.current = agents;
      return;
    }

    // 处理状态变化的异步函数
    const handleStatusChanges = async () => {
      const promises: Promise<void>[] = [];

      agents.forEach((agent) => {
        const prevAgent = prevAgentsRef.current.find((a) => a.id === agent.id);
        if (prevAgent && prevAgent.status !== agent.status) {
          // 记录进入交谈状态
          if (agent.status === "talking" && agent.talkingWith) {
            const targetAgent = agents.find((a) => a.id === agent.talkingWith);
            const conversationKey = `${Math.min(
              agent.id,
              agent.talkingWith
            )}-${Math.max(agent.id, agent.talkingWith)}`;

            // 避免重复记录同一个对话
            if (!recordedConversationsRef.current.has(conversationKey)) {
              recordedConversationsRef.current.add(conversationKey);
              promises.push(
                addLog({
                  type: "conversation_start",
                  agentId: agent.id,
                  agentName: agent.name,
                  content: `${agent.name} 开始与 ${
                    targetAgent?.name || "Unknown"
                  } 交谈`,
                  targetAgentId: agent.talkingWith,
                  targetAgentName: targetAgent?.name,
                  conversationId: conversationKey,
                })
              );
            }
          }
          // 记录退出交谈状态
          else if (prevAgent.status === "talking" && prevAgent.talkingWith) {
            const targetAgent = agents.find(
              (a) => a.id === prevAgent.talkingWith
            );
            const conversationKey = `${Math.min(
              agent.id,
              prevAgent.talkingWith
            )}-${Math.max(agent.id, prevAgent.talkingWith)}`;

            // 移除记录的对话，允许下次重新记录
            recordedConversationsRef.current.delete(conversationKey);
            promises.push(
              addLog({
                type: "conversation_end",
                agentId: agent.id,
                agentName: agent.name,
                content: `${agent.name} 结束与 ${
                  targetAgent?.name || "Unknown"
                } 的交谈`,
                targetAgentId: prevAgent.talkingWith,
                targetAgentName: targetAgent?.name,
                conversationId: conversationKey,
              })
            );
          }
        }
      });

      // 等待所有日志保存完成
      if (promises.length > 0) {
        try {
          await Promise.all(promises);
        } catch (error) {
          console.error("保存日志失败:", error);
        }
      }
    };

    handleStatusChanges();
    prevAgentsRef.current = agents;
  }, [agents]);

  // 监听对话事件（移除，避免重复记录）
  // useEffect(() => {
  //   Object.entries(activeConversations).forEach(([conversationId, conversation]) => {
  //     const participants = conversation.participants.map((id: any) => {
  //       const agent = agents.find(a => a.id === id);
  //       return agent?.name || `Agent ${id}`;
  //     }).join(' 和 ');

  //     addLog({
  //       type: "conversation_start",
  //       agentId: conversation.participants[0],
  //       agentName: participants,
  //       content: `${participants} 开始对话`,
  //       metadata: {
  //         conversationId,
  //         targetAgentId: conversation.participants[1],
  //         targetAgentName: agents.find(a => a.id === conversation.participants[1])?.name
  //       }
  //     });
  //   });
  // }, [activeConversations, agents]);

  // 获取最近的思考记录（包含对话记录）
  const fetchRecentThoughts = async () => {
    setIsLoadingThoughts(true);
    try {
      const response = await fetch("/api/thoughts?limit=20");
      const result = await response.json();
      if (result.success) {
        setRecentThoughts(result.data);
      }
    } catch (error) {
      console.error("获取思考记录失败:", error);
    } finally {
      setIsLoadingThoughts(false);
    }
  };

  // 组件加载时获取思考记录
  useEffect(() => {
    fetchRecentThoughts();
    // 每30秒刷新一次
    const interval = setInterval(fetchRecentThoughts, 30000);
    return () => clearInterval(interval);
  }, []);

  // 监听窗口大小变化，设置全屏地图
  useEffect(() => {
    const updateStageSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setStageSize({ width, height });
    };

    // 初始设置
    updateStageSize();

    // 监听窗口大小变化
    window.addEventListener("resize", updateStageSize);

    return () => {
      window.removeEventListener("resize", updateStageSize);
    };
  }, []);

  // 从思考记录中过滤出对话记录
  const conversationThoughts = recentThoughts.filter(
    (thought) => thought.type === "conversation"
  );

  // 移除不再需要的兼容代码
  // const compatibleConversationMessages = conversationThoughts.map(
  //   (thought) => ({
  //     speaker: thought.agentName,
  //     content: thought.content,
  //     timestamp: thought.timestamp,
  //     emotion: thought.metadata?.emotion,
  //   })
  // );

  // 处理代理点击事件
  const handleAgentClick = (agentId: number) => {
    setSelectedAgentId(agentId);
  };

  // 关闭代理信息面板
  const handleCloseAgentInfo = () => {
    setSelectedAgentId(null);
  };

  // 缩放功能
  const handleWheel = (e: any) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = SCALE_BY;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let newScale = e.evt.deltaY > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

    setStageScale(newScale);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setStagePosition(newPos);
    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);
  };

  // 地图拖拽功能
  const handleStageDragEnd = () => {
    const stage = stageRef.current;
    if (!stage) return;

    setStagePosition({ x: stage.x(), y: stage.y() });
  };

  // 缩放控制函数
  const zoomIn = () => {
    const stage = stageRef.current;
    if (!stage) return;

    const newScale = Math.min(MAX_SCALE, stageScale * 1.2);
    const center = {
      x: stageSize.width / 2,
      y: stageSize.height / 2,
    };

    const newPos = {
      x:
        center.x -
        (center.x * newScale) / stageScale +
        stagePosition.x * (newScale / stageScale - 1),
      y:
        center.y -
        (center.y * newScale) / stageScale +
        stagePosition.y * (newScale / stageScale - 1),
    };

    setStageScale(newScale);
    setStagePosition(newPos);
    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);
  };

  const zoomOut = () => {
    const stage = stageRef.current;
    if (!stage) return;

    const newScale = Math.max(MIN_SCALE, stageScale / 1.2);
    const center = {
      x: stageSize.width / 2,
      y: stageSize.height / 2,
    };

    const newPos = {
      x:
        center.x -
        (center.x * newScale) / stageScale +
        stagePosition.x * (newScale / stageScale - 1),
      y:
        center.y -
        (center.y * newScale) / stageScale +
        stagePosition.y * (newScale / stageScale - 1),
    };

    setStageScale(newScale);
    setStagePosition(newPos);
    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);
  };

  const resetZoom = () => {
    const stage = stageRef.current;
    if (!stage) return;

    setStageScale(1);
    setStagePosition({ x: 0, y: 0 });
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
  };

  // 检查位置是否在障碍物内部 (enhanced with wall system)
  const isPointInObstacle = (x: number, y: number): boolean => {
    // Check legacy obstacles
    const inLegacyObstacle = MAP_CONFIG.obstacles.some(
      (obstacle) =>
        x >= obstacle.x &&
        x <= obstacle.x + obstacle.width &&
        y >= obstacle.y &&
        y <= obstacle.y + obstacle.height
    );

    // Check walls (but not doors)
    const inWall = MAP_CONFIG.walls.some(
      (wall) =>
        x >= wall.x &&
        x <= wall.x + wall.width &&
        y >= wall.y &&
        y <= wall.y + wall.height
    );

    // Check if point is in a door opening (doors allow passage)
    const inDoor = MAP_CONFIG.doors.some(
      (door) =>
        door.isOpen &&
        x >= door.x &&
        x <= door.x + door.width &&
        y >= door.y &&
        y <= door.y + door.height
    );

    return (inLegacyObstacle || inWall) && !inDoor;
  };

  // 检查位置是否在地图边界内
  const isPointInBounds = (x: number, y: number): boolean => {
    const margin = 15; // 给agent留一些边距
    return (
      x >= margin &&
      x <= MAP_CONFIG.width - margin &&
      y >= margin &&
      y <= MAP_CONFIG.height - margin
    );
  };

  // 获取有效的拖拽位置
  const getValidDragPosition = (
    x: number,
    y: number
  ): { x: number; y: number } => {
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
          const testX = originalX + radius * Math.cos((angle * Math.PI) / 180);
          const testY = originalY + radius * Math.sin((angle * Math.PI) / 180);

          if (
            isPointInBounds(testX, testY) &&
            !isPointInObstacle(testX, testY)
          ) {
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
    const agent = agents.find((a) => a.id === agentId);
    console.log(`📄 开始拖拽 Agent ${agentId}, 当前状态: ${agent?.status}`);

    // 如果agent正在行走，立即中断行走动画和服务器任务
    if (agent?.status === "walking") {
      console.log(`⏹️ 中断 Agent ${agentId} 的行走动画和服务器任务`);

      // 立即停止本地动画 - 传入false以保持当前位置但不更新为idle（拖拽会接管状态）
      stopAgentAnimation(agentId, false);

      // 通知服务器停止任务
      if (socket) {
        socket.emit("stopAgentMovement", { agentId });
      }
    }

    setDraggingAgentId(agentId);

    // 清除之前的节流定时器
    if (dragThrottleRef.current[agentId]) {
      clearTimeout(dragThrottleRef.current[agentId]!);
      dragThrottleRef.current[agentId] = null;
    }

    // 获取当前实际位置（可能来自动画）
    const agentCircle = agentCirclesRef.current[agentId];
    const currentPosition = agentCircle
      ? { x: agentCircle.x(), y: agentCircle.y() }
      : agent?.position || { x: 0, y: 0 };

    // 立即更新agent状态为idle并同步位置
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId
          ? {
              ...a,
              position: currentPosition,
              status: "idle" as const,
              target: null,
              walkStartTime: undefined,
              walkDuration: undefined,
            }
          : a
      )
    );

    // 通知服务器拖拽开始状态
    if (socket) {
      socket.emit("agentUpdate", {
        agentId,
        status: "idle",
        position: currentPosition,
      });
    }
  };

  // 处理agent拖拽中
  const handleAgentDragMove = (
    agentId: number,
    newPos: { x: number; y: number }
  ) => {
    const validPos = getValidDragPosition(newPos.x, newPos.y);

    // 节流更新服务器位置（每200ms最多一次）
    if (dragThrottleRef.current[agentId]) {
      clearTimeout(dragThrottleRef.current[agentId]!);
    }

    dragThrottleRef.current[agentId] = setTimeout(() => {
      if (socket && draggingAgentId === agentId) {
        socket.emit("agentUpdate", {
          agentId,
          status: "idle", // 拖拽中保持idle状态
          position: validPos,
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
  const handleAgentDragEnd = (
    agentId: number,
    finalPos: { x: number; y: number }
  ) => {
    const validPos = getValidDragPosition(finalPos.x, finalPos.y);
    console.log(
      `🏁 Agent ${agentId} 拖拽结束，位置: (${Math.round(
        validPos.x
      )}, ${Math.round(validPos.y)})`
    );

    setDraggingAgentId(null);

    // 清除节流定时器
    if (dragThrottleRef.current[agentId]) {
      clearTimeout(dragThrottleRef.current[agentId]!);
      dragThrottleRef.current[agentId] = null;
    }

    // 立即发送最终位置到服务器
    if (socket) {
      socket.emit("agentUpdate", {
        agentId,
        status: "idle", // 恢复为空闲状态
        position: validPos,
      });
    }

    // 更新本地agent状态 - 完全重置为idle状态
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              position: validPos,
              status: "idle" as const,
              target: null,
              walkStartTime: undefined,
              walkDuration: undefined,
              talkingWith: undefined,
            }
          : agent
      )
    );

    return validPos;
  };

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      Object.values(dragThrottleRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  return (
    <div className=" bg-gray-100 w-[100vw]">
      {/* 小镇时间显示 */}
      <div className="absolute top-4 left-4 bg-card p-2 rounded-md shadow-sm z-10">
        <div className="text-xs font-medium">
          小镇时间: {townTime.hour.toString().padStart(2, "0")}:
          {townTime.minute.toString().padStart(2, "0")}
        </div>
      </div>

      {/* 活跃对话显示 */}
      <div className="absolute top-16 left-4 bg-card p-2 rounded-md shadow-sm z-10 max-w-[200px]">
        <div className="text-xs font-medium text-yellow-800">
          进行中的对话: {activeConversations.size}
        </div>
        {Array.from(activeConversations.values()).map(
          (conv: any, index: number) => (
            <div key={index} className="text-xs text-yellow-700">
              {conv.agent1Name} ↔ {conv.agent2Name}
            </div>
          )
        )}
      </div>

      <div className="flex w-[100vw] gap-[1vw]">
        <div className="w-[70vw] relative">
          {/* 缩放控制按钮 */}
          <div className="absolute top-2 right-0 z-20 flex flex-col space-y-2">
            <button
              onClick={zoomIn}
              className="w-10 h-10 bg-white border border-gray-300 rounded-lg shadow-md hover:bg-gray-50 flex items-center justify-center font-bold text-lg"
              title="放大"
            >
              +
            </button>
            <button
              onClick={zoomOut}
              className="w-10 h-10 bg-white border border-gray-300 rounded-lg shadow-md hover:bg-gray-50 flex items-center justify-center font-bold text-lg"
              title="缩小"
            >
              −
            </button>
            <button
              onClick={resetZoom}
              className="w-10 h-10 bg-white border border-gray-300 rounded-lg shadow-md hover:bg-gray-50 flex items-center justify-center text-xs"
              title="重置缩放"
            >
              1:1
            </button>
            <div className="bg-white border border-gray-300 rounded-lg shadow-md px-2 py-1 text-xs text-center">
              {Math.round(stageScale * 100)}%
            </div>
          </div>
          {/* 全屏地图画布 */}
          <div className="relative">
            {/* 背景地图图片 */}
            <div
              className="absolute top-0 z-1 left-0 pointer-events-none"
              style={{
                transform: `scale(${stageScale}) translate(${
                  stagePosition.x / stageScale
                }px, ${stagePosition.y / stageScale}px)`,
                transformOrigin: "0 0",
                width: "100%",
                height: "100%",
              }}
            >
              <Image
                src="/map.png"
                alt="map"
                className="w-full h-full object-cover"
                fill
              />
            </div>

            <Stage
              width={stageSize.width}
              height={stageSize.height}
              ref={stageRef}
              scaleX={stageScale}
              scaleY={stageScale}
              x={stagePosition.x}
              y={stagePosition.y}
              onWheel={handleWheel}
              draggable
              onDragEnd={handleStageDragEnd}
            >
              <Layer
                ref={(node) => {
                  if (node) layerRef.current = node;
                }}
              >
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
                    fill={
                      wall.type === WallType.EXTERIOR ? "#34495e" : "#7f8c8d"
                    }
                    stroke={
                      wall.type === WallType.EXTERIOR ? "#2c3e50" : "#95a5a6"
                    }
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
                    {/* 对话状态波纹动效 */}
                    <ConversationRipple
                      x={agent.position.x}
                      y={agent.position.y}
                      isVisible={agent.status === "talking"}
                      layer={layerRef.current}
                    />

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
                        agent.status === "talking"
                          ? "#FFD700"
                          : draggingAgentId === agent.id
                          ? "#4CAF50"
                          : "transparent"
                      }
                      strokeWidth={
                        agent.status === "talking" ||
                        draggingAgentId === agent.id
                          ? 2
                          : 0
                      }
                      scale={
                        agent.status === "talking"
                          ? { x: 1.2, y: 1.2 }
                          : draggingAgentId === agent.id
                          ? { x: 1.1, y: 1.1 }
                          : { x: 1, y: 1 }
                      }
                      // 添加点击事件
                      onClick={() => handleAgentClick(agent.id)}
                      onTap={() => handleAgentClick(agent.id)}
                      // 鼠标悬停效果
                      onMouseEnter={(e) => {
                        const container = e.target.getStage()?.container();
                        if (
                          container &&
                          (agent.status === "idle" ||
                            agent.status === "walking")
                        ) {
                          container.style.cursor = "grab";
                        }
                      }}
                      onMouseLeave={(e) => {
                        const container = e.target.getStage()?.container();
                        if (container) {
                          container.style.cursor = "default";
                        }
                      }}
                      // 拖拽功能（空闲和行走状态可以拖拽，对话中不可以）
                      draggable={
                        agent.status === "idle" || agent.status === "walking"
                      }
                      onDragStart={() => {
                        handleAgentDragStart(agent.id);
                        // 改变鼠标样式
                        const container = stageRef.current?.container();
                        if (container) {
                          container.style.cursor = "grabbing";
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
                          container.style.cursor = "grab";
                        }
                      }}
                    />
                    <Text
                      ref={(node) => {
                        if (node) agentTextsRef.current[agent.id] = node;
                      }}
                      text={`${agent.name} ${
                        agent.status === "talking" ? "💬" : ""
                      }`}
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
        </div>

        {/* 侧边栏 */}
        <div className="w-[29vw] absolute right-0 top-0 bg-white shadow-lg rounded-lg p-4 flex flex-col h-[100vh]">
          {/* Agents 状态列表 */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              Agents 状态
            </h3>
            <div className="space-y-2 overflow-auto max-h-[200px]">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`p-2 rounded-lg border text-sm ${
                    agent.status === "talking"
                      ? "bg-green-50 border-green-200"
                      : agent.status === "walking"
                      ? "bg-blue-50 border-blue-200"
                      : agent.status === "seeking"
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: agent.color }}
                      />
                      <span className="font-medium text-gray-700">
                        {agent.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          agent.status === "talking"
                            ? "bg-green-100 text-green-700"
                            : agent.status === "walking"
                            ? "bg-blue-100 text-blue-700"
                            : agent.status === "seeking"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {agent.status === "talking"
                          ? "💬 交谈中"
                          : agent.status === "walking"
                          ? "🚶 行走中"
                          : agent.status === "seeking"
                          ? "🔍 寻找中"
                          : "😴 空闲"}
                      </span>
                      {agent.talkingWith && (
                        <span className="text-xs text-gray-500">
                          与{" "}
                          {agents.find((a) => a.id === agent.talkingWith)
                            ?.name || "Unknown"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 实时日志 */}
          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              实时日志
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2">
              {logs.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-8">
                  暂无日志记录...
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border-l-4 text-sm ${
                      log.type === "conversation_start"
                        ? "bg-green-50 border-green-400"
                        : log.type === "conversation_end"
                        ? "bg-red-50 border-red-400"
                        : log.type === "conversation_message"
                        ? "bg-yellow-50 border-yellow-400"
                        : "bg-gray-50 border-gray-400"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-700">
                        {log.agentName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-gray-600">{log.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Agent详情右侧栏 */}
      {selectedAgentId && (
        <AgentDetailSidebar
          agentId={selectedAgentId}
          onClose={handleCloseAgentInfo}
          agents={agents}
        />
      )}
    </div>
  );
}
