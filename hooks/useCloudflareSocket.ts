// hooks/useCloudflareSocket.ts - 更新版：连接到 Cloudflare Workers + Supabase
import { useEffect, useRef, useState } from "react";
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

class CloudflareSocket {
  private ws: WebSocket | null = null;
  private callbacks: SocketCallbacks;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private url: string;
  private heartbeatInterval?: number;

  constructor(url: string, callbacks: SocketCallbacks) {
    this.url = url;
    this.callbacks = callbacks;
  }

  connect() {
    try {
      // 将 HTTP/HTTPS URL 转换为 WebSocket URL
      const wsUrl = this.url.replace(/^https?:\/\//, 'wss://').replace(/^ws:\/\//, 'ws://') + '/ws';
      console.log('连接到 Cloudflare Workers WebSocket:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ Cloudflare WebSocket 连接成功');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.callbacks.onConnect();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('解析 WebSocket 消息失败:', error, event.data);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket 连接关闭:', event.code, event.reason);
        this.stopHeartbeat();
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
        this.callbacks.onConnectError(new Error('WebSocket connection failed'));
      };

    } catch (error) {
      console.error('WebSocket 连接初始化失败:', error);
      this.callbacks.onConnectError(error as Error);
    }
  }

  private handleMessage(data: any) {
    const { type, payload } = data;

    switch (type) {
      case 'init':
        console.log("收到初始数据 (Cloudflare):", payload);
        const initialAgents: AgentState[] = payload.agents.map((agent: any) => ({
          id: agent.id,
          name: agent.name,
          position: { x: agent.x, y: agent.y },
          target: null,
          status: agent.status as AgentState["status"] || "idle",
          color: agent.color,
        }));
        this.callbacks.onInit(initialAgents, payload.townTime);
        break;
      
      case 'timeUpdate':
        this.callbacks.onTimeUpdate(payload);
        break;
      
      case 'agentTask':
        this.callbacks.onAgentTask(payload);
        break;
      
      case 'conversation_start':
        this.callbacks.onConversationStart(payload);
        break;
      
      case 'conversation_end':
        this.callbacks.onConversationEnd(payload);
        break;
      
      case 'conversation_message':
        this.callbacks.onConversationMessage(payload);
        break;
      
      case 'stop_agent_movement':
        this.callbacks.onStopAgentMovement(payload);
        break;
      
      case 'agentStateUpdate':
        this.callbacks.onAgentStateUpdate(payload);
        break;
      
      case 'server_shutdown':
        console.log('服务器正在关闭:', payload.message);
        break;
        
      default:
        console.log('未知消息类型:', type, payload);
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', payload: { timestamp: Date.now() } }));
      }
    }, 30000); // 每30秒发送一次心跳
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts}) - ${delay}ms 后重试`);
      setTimeout(() => this.connect(), delay);
    } else {
      console.error('达到最大重连次数，停止重连');
      this.callbacks.onConnectError(new Error('Maximum reconnection attempts reached'));
    }
  }

  emit(event: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: event, payload: data }));
    } else {
      console.warn('WebSocket 未连接，无法发送消息:', event, data);
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get readyState() {
    return this.ws?.readyState;
  }
}

export const useCloudflareSocket = (callbacks: SocketCallbacks) => {
  const socketRef = useRef<CloudflareSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("正在连接...");

  useEffect(() => {
    // Cloudflare Workers WebSocket URL
    const wsUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WS_URL || "http://localhost:8787";
    console.log('使用 Cloudflare WebSocket URL:', wsUrl);
    
    const socket = new CloudflareSocket(wsUrl, {
      ...callbacks,
      onConnect: () => {
        setConnectionStatus("已连接 (Cloudflare)");
        callbacks.onConnect();
      },
      onConnectError: (err) => {
        setConnectionStatus(`连接错误: ${err.message}`);
        callbacks.onConnectError(err);
      },
    });

    socketRef.current = socket;
    socket.connect();

    return () => {
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
      console.log(`Agent ${agentId} 任务完成 (Cloudflare)，状态: ${status}`);
    }
  };

  const updateAgent = (
    agentId: number,
    status?: string,
    position?: { x: number; y: number }
  ) => {
    if (socketRef.current) {
      socketRef.current.emit("agentUpdate", {
        agentId,
        status,
        position,
      });
    }
  };

  const stopAgentMovement = (agentId: number) => {
    if (socketRef.current) {
      socketRef.current.emit("stopAgentMovement", { agentId });
    }
  };

  return {
    socket: socketRef.current,
    connectionStatus,
    reportTaskComplete,
    updateAgent,
    stopAgentMovement,
  };
};