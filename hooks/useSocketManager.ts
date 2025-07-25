// hooks/useSocketManager.ts
import { useEffect, useRef, useState } from "react";
import { AgentState, AgentTask } from "@/lib/map-config";
import Konva from "konva";
import { useSocket } from "./useSocket";
import { useAgentAnimation } from "./useAgentAnimation";
import { useConversation } from "./useConversation";

export const useSocketManager = () => {
  const [townTime, setTownTime] = useState({ hour: 8, minute: 0 });
  const [realTimeSeconds, setRealTimeSeconds] = useState(0);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const agentsRef = useRef<AgentState[]>([]);
  
  // 同步agents状态到ref
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  const agentCirclesRef = useRef<{ [key: number]: Konva.Circle }>({});
  const agentTextsRef = useRef<{ [key: number]: Konva.Text }>({});

  // 使用拆分的hooks
  const { activeConversations, conversationMessages, handleConversationStart, handleConversationEnd } = useConversation();

  const { socket, connectionStatus, reportTaskComplete } = useSocket({
    onConnect: () => {},
    onConnectError: () => {},
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
      handleConversationStart(data, setAgents);
    },
    onConversationEnd: (data) => {
      handleConversationEnd(data, setAgents);
    }
  });

  const { animateAgentMovement, animationsRef } = useAgentAnimation(
    { agentCirclesRef, agentTextsRef },
    {
      onAgentUpdate: setAgents,
      onTaskComplete: (agentId, status, position) => {
        reportTaskComplete(agentId, status, position);
      },
      getCurrentAgents: () => agentsRef.current,
    }
  );

  const handleAgentTask = (task: AgentTask) => {
    const { agentId } = task;

    switch (task.task.type) {
      case "move":
        console.log(task, "move task");
        if (task.task.to) {
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
          const position = circle ? 
            { x: circle.x(), y: circle.y() } : 
            { x: 0, y: 0 };
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
          const position = circle ? 
            { x: circle.x(), y: circle.y() } : 
            { x: 0, y: 0 };
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
    activeConversations,
    conversationMessages
  };
};