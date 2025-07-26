// hooks/useSocket.ts
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { AgentState, AgentTask } from "@/lib/map-config";

interface SocketCallbacks {
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
  onConversationMessage: (data: any) => void;
  onStopAgentMovement: (data: { agentId: number }) => void;
  onAgentStateUpdate: (data: { agentId: number; status: string; position: { x: number; y: number } }) => void;
}

const setupSocketListeners = (socket: Socket, callbacks: SocketCallbacks) => {
  socket.on("connect", callbacks.onConnect);
  socket.on("connect_error", callbacks.onConnectError);

  socket.on("init", (data) => {
    console.log("收到初始数据:", data);
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

  socket.on("timeUpdate", callbacks.onTimeUpdate);
  socket.on("agentTask", callbacks.onAgentTask);
  socket.on("conversation_start", callbacks.onConversationStart);
  socket.on("conversation_end", callbacks.onConversationEnd);
  socket.on("conversation_message", callbacks.onConversationMessage);
  socket.on("stop_agent_movement", callbacks.onStopAgentMovement);
  socket.on("agentStateUpdate", callbacks.onAgentStateUpdate);

  return () => {
    socket.off("connect", callbacks.onConnect);
    socket.off("connect_error", callbacks.onConnectError);
    socket.off("init");
    socket.off("timeUpdate");
    socket.off("agentTask");
    socket.off("conversation_start");
    socket.off("conversation_end");
    socket.off("conversation_message");
    socket.off("stop_agent_movement");
    socket.off("agentStateUpdate");
  };
};

export const useSocket = (callbacks: SocketCallbacks) => {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("正在连接...");

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000";
    console.log("正在连接到WebSocket:", wsUrl);

    const socket = io(wsUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socketRef.current = socket;

    const cleanupListeners = setupSocketListeners(socket, {
      ...callbacks,
      onConnect: () => {
        console.log("WebSocket连接成功");
        setConnectionStatus("已连接");
        callbacks.onConnect();
      },
      onConnectError: (err) => {
        console.error("WebSocket连接错误:", err);
        setConnectionStatus(`连接错误: ${err.message}`);
        callbacks.onConnectError(err);
      },
    });

    return () => {
      cleanupListeners();
      socket.disconnect();
    };
  }, []);

  const reportTaskComplete = (
    agentId: number,
    status: AgentState["status"],
    position: { x: number; y: number }
  ) => {
    if (socketRef.current) {
      socketRef.current.emit("task_complete", {
        agentId,
        status,
        position,
      });
      console.log(`Agent ${agentId} 任务完成，状态: ${status}`);
    }
  };

  return {
    socket: socketRef.current,
    connectionStatus,
    reportTaskComplete,
  };
};