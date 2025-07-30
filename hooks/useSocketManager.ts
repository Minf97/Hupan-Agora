// hooks/useSocketManager.ts
import { useEffect, useRef, useState } from "react";
import { AgentState, AgentTask } from "@/lib/map-config";
import Konva from "konva";
import { useCloudflareSocket } from "./useCloudflareSocket";
import { useAgentAnimation } from "./useAgentAnimation";
import { useConversation } from "./useConversation";
import { useThoughtLogger } from "./useThoughtLogger";
import { initializeAIService } from "@/lib/ai-config";

export const useSocketManager = () => {
  const [townTime, setTownTime] = useState({ hour: 8, minute: 0 });
  const [realTimeSeconds, setRealTimeSeconds] = useState(0);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const agentsRef = useRef<AgentState[]>([]);

  // 实时日志状态和处理函数
  const [realtimeLogs, setRealtimeLogs] = useState<
    Array<{
      id: string;
      timestamp: number;
      type: "conversation" | "inner_thought" | "decision";
      agentName: string;
      content: string;
      emotion?: string;
    }>
  >([]);

  const addRealtimeLog = (entry: {
    type: "conversation" | "inner_thought" | "decision";
    agentName: string;
    content: string;
    emotion?: string;
  }) => {
    const logEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      ...entry,
    };

    setRealtimeLogs((prev) => [logEntry, ...prev].slice(0, 50)); // 只保留最新50条
    console.log(`📝 添加实时日志: ${entry.agentName} - ${entry.content}`);
  };

  // 初始化AI服务
  useEffect(() => {
    initializeAIService();
  }, []);

  // 同步agents状态到ref
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  const agentCirclesRef = useRef<{ [key: number]: Konva.Group }>({});
  const agentTextsRef = useRef<{ [key: number]: Konva.Text }>({});

  // 使用拆分的hooks
  const {
    activeConversations,
    conversationMessages,
    handleConversationStart,
    handleConversationEnd,
    handleConversationMessage,
  } = useConversation();
  const thoughtLogger = useThoughtLogger();

  const { socket, connectionStatus, reportTaskComplete } = useCloudflareSocket({
    onConnect: () => {},
    onConnectError: () => {},
    onInit: (initialAgents, newTownTime) => {
      console.log(initialAgents, "initialAgents");
      
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
      handleConversationStart(data, setAgents);
    },
    onConversationEnd: (data) => {
      handleConversationEnd(data, setAgents, clearConversationState);
    },
    onConversationMessage: (data) => {
      handleConversationMessage(data);
    },
    onStopAgentMovement: (data: { agentId: number }) => {
      console.log(`收到停止Agent ${data.agentId} 移动的请求`);
      stopAgentAnimation(data.agentId);
    },
    onAgentStateUpdate: (data: {
      agentId: number;
      status: string;
      position: { x: number; y: number };
    }) => {
      console.log(
        `🔄 收到Agent ${data.agentId} 状态更新: ${data.status}`,
        data.position
      );

      // 如果状态变为talking，需要立即停止该agent的移动动画
      if (data.status === "talking") {
        console.log(
          `🛑 停止Agent ${data.agentId} 的移动动画（进入talking状态）`
        );
        stopAgentAnimation(data.agentId, false); // 不设置为idle，保持talking状态

        // 立即更新 Konva circle 和 text 的位置
        const circle = agentCirclesRef.current[data.agentId];
        const text = agentTextsRef.current[data.agentId];

        if (circle) {
          circle.x(data.position.x);
          circle.y(data.position.y);
          circle.getLayer()?.batchDraw();
        }

        if (text) {
          text.x(data.position.x);
          text.y(data.position.y - 15);
          text.getLayer()?.batchDraw();
        }
      }

      // 立即更新agent状态
      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === data.agentId
            ? {
                ...agent,
                status: data.status as AgentState["status"],
                position: data.position,
              }
            : agent
        )
      );
    },
  });

  const {
    animateAgentMovement,
    animationsRef,
    stopAgentAnimation,
    clearConversationState,
  } = useAgentAnimation(
    { agentCirclesRef, agentTextsRef },
    {
      onAgentUpdate: setAgents,
      onTaskComplete: (agentId, status, position) => {
        reportTaskComplete(agentId, status, position);
      },
      getCurrentAgents: () => agentsRef.current,
      onAgentEncounter: (agent1Id, agent2Id, location) => {
        console.log(
          `Agent相遇事件被触发: ${agent1Id} 和 ${agent2Id} 在 ${location}`
        );
        // 这里可以添加额外的业务逻辑，比如统计、日志等
      },
      onThoughtLog: {
        addInnerThought: thoughtLogger.addInnerThought,
        addDecision: thoughtLogger.addDecision,
        addConversation: thoughtLogger.addConversation,
      },
      onRealtimeLog: addRealtimeLog, // 添加实时日志回调
    }
  );

  const handleAgentTask = (task: AgentTask) => {
    const { agentId } = task;

    switch (task.task.type) {
      case "move":
        // console.log(task, "move task");
        if (task.task.to) {
          // 检查agent当前状态，如果正在聊天则忽略移动任务
          const currentAgent = agentsRef.current.find(agent => agent.id === agentId);
          if (currentAgent && currentAgent.status === "talking") {
            console.log(`🚫 Agent ${agentId} 正在聊天，忽略移动任务`);
            return;
          }
          animateAgentMovement(agentId, task.task.to);
        }
        break;
      case "talk":
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
        setTimeout(() => {
          setAgents((prev) =>
            prev.map((agent) =>
              agent.id === agentId
                ? { ...agent, status: "idle" as const, talkingWith: undefined }
                : agent
            )
          );
          const circle = agentCirclesRef.current[agentId];
          const position = circle
            ? { x: circle.x(), y: circle.y() }
            : { x: 0, y: 0 };
          reportTaskComplete(agentId, "idle", position);
        }, task.task.duration || 5000);
        break;
      case "seek":
        setAgents((prev) =>
          prev.map((agent) =>
            agent.id === agentId
              ? { ...agent, status: "seeking" as const }
              : agent
          )
        );
        setTimeout(() => {
          setAgents((prev) =>
            prev.map((agent) =>
              agent.id === agentId
                ? { ...agent, status: "idle" as const }
                : agent
            )
          );
          const circle = agentCirclesRef.current[agentId];
          const position = circle
            ? { x: circle.x(), y: circle.y() }
            : { x: 0, y: 0 };
          reportTaskComplete(agentId, "idle", position);
        }, 3000);
        break;
    }
  };

  return {
    socket,
    connectionStatus,
    townTime,
    realTimeSeconds,
    agents,
    setAgents,
    agentCirclesRef,
    agentTextsRef,
    animationsRef,
    stopAgentAnimation,
    activeConversations,
    conversationMessages,
    thoughtLogger,
    realtimeLogs, // 添加实时日志数据
    addRealtimeLog, // 添加实时日志方法
  };
};
