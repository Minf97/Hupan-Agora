// lib/hooks/useSocketManager.ts
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAgentStore } from "@/store/agents";
import { MAP_CONFIG, AgentState, AgentTask } from "@/lib/map-config";
import Konva from "konva";
import PF from "pathfinding";

// 计算两点间距离
const calculateDistance = (
  pos1: { x: number; y: number },
  pos2: { x: number; y: number }
) => {
  return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
};

// 检查两个agent是否相遇（距离小于30像素）
const checkAgentsMeeting = (agent1: AgentState, agent2: AgentState) => {
  return calculateDistance(agent1.position, agent2.position) < 30;
};

// 将事件处理函数移到 hook 外部，避免闭包问题
const setupSocketListeners = (
  socket: Socket,
  callbacks: {
    onConnect: () => void;
    onConnectError: (err: Error) => void;
    onInit: (
      initialAgents: AgentState[],
      townTime: { hour: number; minute: number }
    ) => void;
    onTimeUpdate: (newTime: { hour: number; minute: number }) => void;
    onAgentTask: (task: AgentTask) => void;
    onConversationStart: (data: any) => void;
    onConversationEnd: (data: any) => void;
  }
) => {
  // 监听连接事件
  socket.on("connect", callbacks.onConnect);

  socket.on("connect_error", callbacks.onConnectError);

  // 接收初始数据
  socket.on("init", (data) => {
    console.log("收到初始数据:", data);
    // 转换数据格式为AgentState
    const initialAgents: AgentState[] = data.agents.map((agent: any) => ({
      id: agent.id,
      name: agent.name,
      position: { x: agent.x, y: agent.y },
      target: null,
      status: "idle" as const,
      color: agent.color,
    }));
    callbacks.onInit(initialAgents, data.townTime);
  });

  // 接收时间更新
  socket.on("timeUpdate", (newTime) => {
    callbacks.onTimeUpdate(newTime);
  });

  // 接收任务
  socket.on("agentTask", (task: AgentTask) => {
    console.log("收到任务:", task);
    callbacks.onAgentTask(task);
  });

  // 监听对话开始事件
  socket.on("conversation_start", (data) => {
    console.log("对话开始:", data);
    callbacks.onConversationStart(data);
  });

  // 监听对话结束事件
  socket.on("conversation_end", (data) => {
    console.log("对话结束:", data);
    callbacks.onConversationEnd(data);
  });

  // 返回清理函数
  return () => {
    socket.off("connect", callbacks.onConnect);
    socket.off("connect_error", callbacks.onConnectError);
    socket.off("init");
    socket.off("timeUpdate");
    socket.off("agentTask");
    socket.off("conversation_start");
    socket.off("conversation_end");
  };
};

export const useSocketManager = () => {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("正在连接...");
  const [townTime, setTownTime] = useState({ hour: 8, minute: 0 });
  const [realTimeSeconds, setRealTimeSeconds] = useState(0);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const agentsRef = useRef<AgentState[]>([]);
  
  // 同步agents状态到ref
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);
  
  // 添加对话状态管理
  const [activeConversations, setActiveConversations] = useState(new Map());
  const [conversationMessages, setConversationMessages] = useState<Array<{
    conversationId: string;
    speaker: string;
    content: string;
    timestamp: number;
  }>>([]);

  const animationsRef = useRef<{ [key: number]: Konva.Animation }>({});
  const agentCirclesRef = useRef<{ [key: number]: Konva.Circle }>({});
  const agentTextsRef = useRef<{ [key: number]: Konva.Text }>({});

  // 处理任务完成上报
  const reportTaskComplete = (
    agentId: number,
    status: AgentState["status"]
  ) => {
    if (socketRef.current) {
      // 获取当前agent的位置（直接从DOM元素获取，而不是从状态获取）
      const circle = agentCirclesRef.current[agentId];
      if (circle) {
        socketRef.current.emit("task_complete", {
          agentId,
          status,
          position: { x: circle.x(), y: circle.y() },
        });
        console.log(`Agent ${agentId} 任务完成，状态: ${status}`);
      }
    }
  };

  // 检查agent相遇
  const checkForMeetings = (currentAgents: AgentState[]) => {
    const meetings: { agent1: number; agent2: number }[] = [];

    for (let i = 0; i < currentAgents.length; i++) {
      for (let j = i + 1; j < currentAgents.length; j++) {
        const agent1 = currentAgents[i];
        const agent2 = currentAgents[j];

        // 如果两个agent都是空闲状态且相遇了
        if (
          agent1.status === "idle" &&
          agent2.status === "idle" &&
          checkAgentsMeeting(agent1, agent2)
        ) {
          meetings.push({ agent1: agent1.id, agent2: agent2.id });
        }
      }
    }

    return meetings;
  };

  // 创建寻路网格
  const createGrid = () => {
    // 创建网格
    const gridWidth = Math.ceil(MAP_CONFIG.width / MAP_CONFIG.gridSize);
    const gridHeight = Math.ceil(MAP_CONFIG.height / MAP_CONFIG.gridSize);
    const grid = new PF.Grid(gridWidth, gridHeight);

    // 标记障碍物
    MAP_CONFIG.obstacles.forEach(
      (obstacle: { x: number; y: number; width: number; height: number }) => {
        const startX = Math.floor(obstacle.x / MAP_CONFIG.gridSize);
        const startY = Math.floor(obstacle.y / MAP_CONFIG.gridSize);
        const endX = Math.ceil(
          (obstacle.x + obstacle.width) / MAP_CONFIG.gridSize
        );
        const endY = Math.ceil(
          (obstacle.y + obstacle.height) / MAP_CONFIG.gridSize
        );

        for (let x = startX; x < endX; x++) {
          for (let y = startY; y < endY; y++) {
            if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
              grid.setWalkableAt(x, y, false);
            }
          }
        }
      }
    );

    return grid;
  };

  // 网格坐标转换为像素坐标
  const gridToPixel = (x: number, y: number) => ({
    x: (x + 0.5) * MAP_CONFIG.gridSize,
    y: (y + 0.5) * MAP_CONFIG.gridSize,
  });

  // 像素坐标转换为网格坐标
  const pixelToGrid = (x: number, y: number) => ({
    x: Math.floor(x / MAP_CONFIG.gridSize),
    y: Math.floor(y / MAP_CONFIG.gridSize),
  });

  // 引用网格
  const gridRef = useRef(createGrid());

  // 应用平滑动画
  const animateAgentMovement = (
    agentId: number,
    targetPosition: { x: number; y: number }
  ) => {
    const agentCircle = agentCirclesRef.current[agentId];
    const agentText = agentTextsRef.current[agentId];

    if (!agentCircle || !agentText) return;

    // 如果已存在该agent的动画，先停止
    if (animationsRef.current[agentId]) {
      animationsRef.current[agentId].stop();
    }

    // 获取当前位置
    const currentX = agentCircle.x();
    const currentY = agentCircle.y();

    // 使用 A* 寻路算法计算路径
    // 首先，转换为网格坐标
    const startGrid = pixelToGrid(currentX, currentY);
    const endGrid = pixelToGrid(targetPosition.x, targetPosition.y);

    // 创建寻路器
    const finder = new PF.AStarFinder({
      allowDiagonal: true,
      dontCrossCorners: false,
    });

    // 克隆网格（因为寻路过程会修改网格）
    const gridClone = gridRef.current.clone();

    // 计算路径
    const path = finder.findPath(
      startGrid.x,
      startGrid.y,
      endGrid.x,
      endGrid.y,
      gridClone
    );

    // console.log(
    //   `为Agent ${agentId} 计算路径，从 (${startGrid.x}, ${startGrid.y}) 到 (${endGrid.x}, ${endGrid.y})`
    // );
    // console.log("路径:", path);

    // 如果没有找到路径，则返回
    if (path.length === 0) {
      console.error(`无法为Agent ${agentId} 找到到达目标的路径`);
      return;
    }

    // 转换回像素坐标
    const pixelPath = path.map(([x, y]) => gridToPixel(x, y));

    // 计算路径的总长度
    let totalDistance = 0;
    for (let i = 1; i < pixelPath.length; i++) {
      const dx = pixelPath[i].x - pixelPath[i - 1].x;
      const dy = pixelPath[i].y - pixelPath[i - 1].y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);
    }

    // 设定移动速度（像素/秒）
    const moveSpeed = 50; // 可以调整此值以改变移动速度

    // 根据距离和速度计算动画持续时间（毫秒）
    const duration = (totalDistance / moveSpeed) * 1000;

    // 更新agent状态为walking
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              status: "walking" as const,
              walkStartTime: Date.now(),
              walkDuration: duration,
            }
          : agent
      )
    );

    // 创建动画相关变量
    let currentPathIndex = 1; // 从路径的第二个点开始（第一个是起点）
    let segmentStartTime = 0;
    let segmentProgress = 0;
    let currentSegmentStartX = currentX;
    let currentSegmentStartY = currentY;
    let currentSegmentEndX = pixelPath[currentPathIndex].x;
    let currentSegmentEndY = pixelPath[currentPathIndex].y;
    let currentSegmentDistance = Math.sqrt(
      Math.pow(currentSegmentEndX - currentSegmentStartX, 2) +
        Math.pow(currentSegmentEndY - currentSegmentStartY, 2)
    );

    // 创建新动画
    const animation = new Konva.Animation((frame) => {
      if (!frame) return;

      // 计算动画经过的时间
      const elapsedTime = frame.time - segmentStartTime;

      // 如果还在当前路径段内
      if (segmentProgress < 1) {
        // 更新进度
        segmentProgress = Math.min(
          elapsedTime / ((currentSegmentDistance / totalDistance) * duration),
          1
        );

        // 计算当前位置
        const newX =
          currentSegmentStartX +
          (currentSegmentEndX - currentSegmentStartX) * segmentProgress;
        const newY =
          currentSegmentStartY +
          (currentSegmentEndY - currentSegmentStartY) * segmentProgress;

        // 更新位置
        agentCircle.x(newX);
        agentCircle.y(newY);
        agentText.x(newX - 15);
        agentText.y(newY - 25);
        
        // 在移动过程中检查是否有相遇
        // 获取当前所有agents的最新位置
        const currentPositions = { ...agentCirclesRef.current };
        const currentAgentsPositions = Object.keys(currentPositions).map(id => {
          const circle = currentPositions[Number(id)];
          return {
            id: Number(id),
            position: { x: circle.x(), y: circle.y() }
          };
        });
        
        // 检查当前移动的agent是否与其他空闲agent相遇
        const currentMovingAgentPosition = { x: newX, y: newY };
        const otherIdleAgents = agentsRef.current.filter(a => a.id !== agentId);
        // console.log(otherIdleAgents, "otherIdleAgents", agentsRef.current);
        
        
        for (const idleAgent of otherIdleAgents) {
          const idleAgentCircle = currentPositions[idleAgent.id];
          if (idleAgentCircle) {
            const idleAgentPosition = { x: idleAgentCircle.x(), y: idleAgentCircle.y() };
            const distance = calculateDistance(currentMovingAgentPosition, idleAgentPosition);
            
            if (distance < 30) {
              console.log(`移动中: Agent ${agentId} 和 Agent ${idleAgent.id} 相遇了！`);
              
              // 停止当前动画
              animation.stop();
              delete animationsRef.current[agentId];
              
              // 更新agent状态为idle
              setAgents((prev) => {
                const updatedAgents = prev.map((agent) =>
                  agent.id === agentId
                    ? {
                        ...agent,
                        position: { x: newX, y: newY },
                        status: "idle" as const,
                        target: null,
                        walkStartTime: undefined,
                        walkDuration: undefined,
                      }
                    : agent
                );
                
                // 手动触发相遇事件
                const meeting = { agent1: agentId, agent2: idleAgent.id };
                console.log(`中途相遇: Agent ${meeting.agent1} 和 Agent ${meeting.agent2} 相遇了！`);
                // 这里可以触发对话事件
                
                return updatedAgents;
              });
              
              // 上报任务完成
              reportTaskComplete(agentId, "idle");
              
              // 提前退出动画循环
              return;
            }
          }
        }

        // 如果当前路径段完成
        if (segmentProgress >= 1) {
          // 如果还有更多路径点
          if (currentPathIndex < pixelPath.length - 1) {
            // 移动到下一个路径段
            currentPathIndex++;
            segmentStartTime = frame.time;
            segmentProgress = 0;
            currentSegmentStartX = currentSegmentEndX;
            currentSegmentStartY = currentSegmentEndY;
            currentSegmentEndX = pixelPath[currentPathIndex].x;
            currentSegmentEndY = pixelPath[currentPathIndex].y;
            currentSegmentDistance = Math.sqrt(
              Math.pow(currentSegmentEndX - currentSegmentStartX, 2) +
                Math.pow(currentSegmentEndY - currentSegmentStartY, 2)
            );
          } else {
            // 整个路径完成
            animation.stop();
            delete animationsRef.current[agentId];

            // 更新agent位置和状态
            setAgents((prev) => {
              const updatedAgents = prev.map((agent) =>
                agent.id === agentId
                  ? {
                      ...agent,
                      position: targetPosition,
                      status: "idle" as const,
                      target: null,
                      walkStartTime: undefined,
                      walkDuration: undefined,
                    }
                  : agent
              );

              // 检查是否有新的相遇
              const meetings = checkForMeetings(updatedAgents);
              meetings.forEach((meeting) => {
                console.log(
                  `Agent ${meeting.agent1} 和 Agent ${meeting.agent2} 相遇了！`
                );
                // 这里可以触发对话事件
              });

              return updatedAgents;
            });

            // 上报任务完成
            reportTaskComplete(agentId, "idle");
          }
        }
      }
    }, agentCircle.getLayer());

    // 存储动画引用并启动
    animationsRef.current[agentId] = animation;
    animation.start();
  };

  // 处理任务逻辑
  const handleAgentTask = (task: AgentTask) => {
    const { agentId } = task;

    // 处理不同类型的任务
    switch (task.task.type) {
      case "move":
        console.log(task, "move task");

        if (task.task.to) {
          animateAgentMovement(agentId, task.task.to);
        }
        break;
      case "talk":
        // 处理对话任务
        setAgents((prev) =>
          prev.map((agent) =>
            agent.id === agentId
              ? {
                  ...agent,
                  status: "talking" as const,
                  talkingWith: task.task.targetAgentId,
                }
              : agent
          )
        );
        // 设置对话持续时间
        setTimeout(() => {
          setAgents((prev) =>
            prev.map((agent) =>
              agent.id === agentId
                ? { ...agent, status: "idle" as const, talkingWith: undefined }
                : agent
            )
          );
          reportTaskComplete(agentId, "idle");
        }, task.task.duration || 5000);
        break;
      case "seek":
        // 处理寻找任务
        setAgents((prev) =>
          prev.map((agent) =>
            agent.id === agentId
              ? { ...agent, status: "seeking" as const }
              : agent
          )
        );
        // 模拟寻找过程
        setTimeout(() => {
          setAgents((prev) =>
            prev.map((agent) =>
              agent.id === agentId
                ? { ...agent, status: "idle" as const }
                : agent
            )
          );
          reportTaskComplete(agentId, "idle");
        }, 3000);
        break;
    }
  };

  const updateAgent = useAgentStore((s) => s.updateAgent);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000";
    console.log("正在连接到WebSocket:", wsUrl);

    // 创建WebSocket连接
    const socket = io(wsUrl, {
      transports: ["websocket", "polling"], // 优先使用WebSocket，备选轮询
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    // 赋值 ref
    socketRef.current = socket;

    // 使用外部函数设置事件监听器，避免闭包问题
    const cleanupListeners = setupSocketListeners(socket, {
      onConnect: () => {
        console.log("WebSocket连接成功");
        setConnectionStatus("已连接");
      },
      onConnectError: (err) => {
        console.error("WebSocket连接错误:", err);
        setConnectionStatus(`连接错误: ${err.message}`);
      },
      onInit: (initialAgents, newTownTime) => {
        setAgents(initialAgents);
        setTownTime(newTownTime);
      },
      onTimeUpdate: (newTime) => {
        setTownTime(newTime);
        setRealTimeSeconds((prev) => prev + 1);
      },
      onAgentTask: (task) => {
        handleAgentTask(task);
      },
      onConversationStart: (data) => {
        // 处理对话开始事件
        const { conversationId, agent1, agent1Name, agent2, agent2Name } = data;
        
        // 更新agent状态
        setAgents((prev) => {
          return prev.map((agent) =>
            agent.id === agent1 || agent.id === agent2
              ? { ...agent, status: "talking" as const }
              : agent
          );
        });
        
        // 添加到活跃对话
        setActiveConversations((prev) => {
          const newMap = new Map(prev);
          newMap.set(conversationId, {
            id: conversationId,
            agent1,
            agent1Name,
            agent2,
            agent2Name,
            startTime: Date.now(),
            messages: []
          });
          return newMap;
        });
        
        // 生成随机的初始对话消息
        setTimeout(() => {
          const initialMessage = {
            conversationId,
            speaker: agent1Name,
            content: "你好，今天天气不错！",
            timestamp: Date.now()
          };
          
          setConversationMessages((prev) => [...prev, initialMessage]);
          
          setTimeout(() => {
            const replyMessage = {
              conversationId,
              speaker: agent2Name,
              content: "是的，阳光明媚，心情也很好！",
              timestamp: Date.now() + 1000
            };
            
            setConversationMessages((prev) => [...prev, replyMessage]);
          }, 1000);
        }, 500);
      },
      onConversationEnd: (data) => {
        // 处理对话结束事件
        const { conversationId, agent1, agent2, messages } = data;
        
        // 更新agent状态
        setAgents((prev) => {
          return prev.map((agent) =>
            agent.id === agent1 || agent.id === agent2
              ? { ...agent, status: "idle" as const }
              : agent
          );
        });
        
        // 从活跃对话中移除
        setActiveConversations((prev) => {
          const newMap = new Map(prev);
          newMap.delete(conversationId);
          return newMap;
        });
        
        // 添加结束消息
        if (messages && messages.length) {
          setConversationMessages((prev) => [...prev, ...messages]);
        }
      }
    });

    return () => {
      cleanupListeners();
      socket.disconnect();
    };
  }, [updateAgent]); // 依赖列表中只有 updateAgent

  return {
    socket: socketRef.current,
    connectionStatus,
    townTime,
    realTimeSeconds,
    agents,
    setAgents,
    agentCirclesRef,
    agentTextsRef,
    animationsRef,
    activeConversations,
    conversationMessages
  };
};
