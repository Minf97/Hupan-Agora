// hooks/useCloudflareSocket.ts - SSR 兼容的全局 WebSocket 连接管理
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
  onAgentStateUpdate: (data: {
    agentId: number;
    status: string;
    position: { x: number; y: number };
  }) => void;
}

// 全局状态管理 - 只在客户端存在
const isBrowser = typeof window !== 'undefined';
let globalSocket: CloudflareSocket | null = null;
let globalConnectionPromise: Promise<void> | null = null;
let connectionAttempts = 0;
let isConnecting = false;
let isShuttingDown = false;

// 使用 Map 来管理回调，并给每个实例分配唯一ID
const callbacksMap = new Map<string, SocketCallbacks>();

class CloudflareSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private url: string;
  private heartbeatInterval?: number;
  private isConnected = false;
  private connectionId: string;

  constructor(url: string) {
    this.url = url;
    this.connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`🆕 创建 WebSocket 实例: ${this.connectionId}`);
  }

  get connected() {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  connect(): Promise<void> {
    // 如果已经连接，直接返回
    if (this.connected) {
      console.log(`✅ WebSocket 已连接，跳过连接: ${this.connectionId}`);
      return Promise.resolve();
    }

    // 如果正在连接，等待现有连接
    if (isConnecting) {
      console.log(`⏳ WebSocket 正在连接中，等待完成: ${this.connectionId}`);
      return globalConnectionPromise || Promise.resolve();
    }

    // 如果正在关闭，不允许新连接
    if (isShuttingDown) {
      console.log(`🛑 WebSocket 正在关闭，不允许新连接: ${this.connectionId}`);
      return Promise.reject(new Error('WebSocket is shutting down'));
    }

    isConnecting = true;
    connectionAttempts++;
    
    return new Promise((resolve, reject) => {
      try {
        let wsUrl;

        // 处理不同格式的 URL
        if (this.url.startsWith("ws://") || this.url.startsWith("wss://")) {
          wsUrl = this.url;
        } else {
          // 正确的协议转换：HTTPS -> WSS, HTTP -> WS
          const protocol = this.url.startsWith("https://") ? "wss://" : "ws://";
          wsUrl = this.url.replace(/^https?:\/\//, protocol);
          if (!wsUrl.endsWith("/ws")) {
            wsUrl += "/ws";
          }
        }

        console.log(`🔌 [尝试 ${connectionAttempts}] 连接 WebSocket: ${wsUrl} (${this.connectionId})`);

        // 先关闭现有连接
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }

        this.ws = new WebSocket(wsUrl);

        const onOpen = () => {
          console.log(`✅ [成功 ${connectionAttempts}] WebSocket 连接成功: ${this.connectionId}`);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          isConnecting = false;
          this.startHeartbeat();
          
          // 通知所有注册的回调
          callbacksMap.forEach((callbacks, id) => {
            try {
              console.log(`📢 通知回调 ${id}: 连接成功`);
              callbacks.onConnect();
            } catch (error) {
              console.error(`❌ 回调 ${id} 执行错误:`, error);
            }
          });
          
          resolve();
        };

        const onMessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error("❌ 解析 WebSocket 消息失败:", error, event.data);
          }
        };

        const onClose = (event: CloseEvent) => {
          console.log(`🔌 [${this.connectionId}] WebSocket 连接关闭:`, event.code, event.reason);
          this.isConnected = false;
          isConnecting = false;
          this.stopHeartbeat();
          
          // 只有在非正常关闭时才尝试重连
          if (!isShuttingDown && event.code !== 1000 && event.code !== 1001) {
            this.attemptReconnect();
          }
        };

        const onError = (error: Event) => {
          console.error(`❌ [${this.connectionId}] WebSocket 连接错误:`, error);
          isConnecting = false;
          
          const errorMsg = new Error(`WebSocket connection failed to ${wsUrl}`);
          
          // 通知所有回调
          callbacksMap.forEach((callbacks, id) => {
            try {
              console.log(`📢 通知回调 ${id}: 连接错误`);
              callbacks.onConnectError(errorMsg);
            } catch (error) {
              console.error(`❌ 错误回调 ${id} 执行失败:`, error);
            }
          });
          
          reject(errorMsg);
        };

        // 绑定事件
        this.ws.onopen = onOpen;
        this.ws.onmessage = onMessage;
        this.ws.onclose = onClose;
        this.ws.onerror = onError;

      } catch (error) {
        console.error(`❌ WebSocket 连接初始化失败 (${this.connectionId}):`, error);
        isConnecting = false;
        const errorMsg = error as Error;
        
        callbacksMap.forEach((callbacks, id) => {
          try {
            callbacks.onConnectError(errorMsg);
          } catch (error) {
            console.error(`❌ 初始化错误回调 ${id} 执行失败:`, error);
          }
        });
        
        reject(errorMsg);
      }
    });
  }

  private handleMessage(data: any) {
    const { type, payload } = data;

    // 向所有注册的回调分发消息
    callbacksMap.forEach((callbacks, id) => {
      try {
        switch (type) {
          case "init":
            console.log(`📦 收到初始数据 (回调 ${id}):`, payload);
            const initialAgents: AgentState[] = payload.agents.map(
              (agent: any) => ({
                id: agent.id,
                name: agent.name,
                position: { x: agent.x, y: agent.y },
                target: null,
                status: (agent.status as AgentState["status"]) || "idle",
                color: agent.color,
                avatar: agent.avatar,
              })
            );
            callbacks.onInit(initialAgents, payload.townTime);
            break;

          case "timeUpdate":
            callbacks.onTimeUpdate(payload);
            break;

          case "agentTask":
            callbacks.onAgentTask(payload);
            break;

          case "conversation_start":
            callbacks.onConversationStart(payload);
            break;

          case "conversation_end":
            callbacks.onConversationEnd(payload);
            break;

          case "conversation_message":
            callbacks.onConversationMessage(payload);
            break;

          case "stop_agent_movement":
            callbacks.onStopAgentMovement(payload);
            break;

          case "agentStateUpdate":
            callbacks.onAgentStateUpdate(payload);
            break;

          case "server_shutdown":
            console.log("🔄 服务器正在关闭:", payload.message);
            break;

          default:
            console.log(`❓ 未知消息类型 (回调 ${id}):`, type, payload);
        }
      } catch (error) {
        console.error(`❌ 处理消息时回调 ${id} 执行错误:`, error);
      }
    });
  }

  private startHeartbeat() {
    // 清除现有心跳
    this.stopHeartbeat();
    
    this.heartbeatInterval = window.setInterval(() => {
      if (this.connected) {
        this.ws!.send(JSON.stringify({ 
          type: "ping", 
          payload: { 
            timestamp: Date.now(),
            connectionId: this.connectionId
          } 
        }));
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && !isShuttingDown) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`🔄 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts}) - ${delay}ms 后重试`);
      
      setTimeout(() => {
        if (!isShuttingDown) {
          this.connect().catch(error => {
            console.error('重连失败:', error);
          });
        }
      }, delay);
    } else {
      console.error("❌ 达到最大重连次数或正在关闭，停止重连");
      const errorMsg = new Error("Maximum reconnection attempts reached or shutting down");
      
      callbacksMap.forEach((callbacks, id) => {
        try {
          callbacks.onConnectError(errorMsg);
        } catch (error) {
          console.error(`❌ 重连失败回调 ${id} 执行错误:`, error);
        }
      });
    }
  }

  emit(event: string, data: any) {
    if (this.connected) {
      this.ws!.send(JSON.stringify({ 
        type: event, 
        payload: { 
          ...data, 
          connectionId: this.connectionId 
        } 
      }));
    } else {
      console.warn(`⚠️ WebSocket 未连接，无法发送消息 (${this.connectionId}):`, event, data);
    }
  }

  disconnect() {
    console.log(`🔌 断开 WebSocket 连接: ${this.connectionId}`);
    isShuttingDown = true;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    isConnecting = false;
  }
}

export const useCloudflareSocket = (callbacks: SocketCallbacks) => {
  const [connectionStatus, setConnectionStatus] = useState("正在连接...");
  const callbacksRef = useRef(callbacks);
  const callbackIdRef = useRef<string>(`callback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  // 更新回调引用
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    // SSR 兼容性检查
    if (!isBrowser) {
      console.log('🚫 服务端渲染环境，跳过WebSocket连接');
      return;
    }

    // 防止在开发模式下的热重载导致重复连接
    if (process.env.NODE_ENV === 'development') {
      // 添加短暂延迟，让React的StrictMode完成双重调用
      const timer = setTimeout(() => {
        initializeConnection();
      }, 100);
      
      return () => {
        clearTimeout(timer);
        cleanup();
      };
    } else {
      initializeConnection();
      return cleanup;
    }

    function initializeConnection() {
      const callbackId = callbackIdRef.current;
      console.log(`🚀 [${callbackId}] 初始化WebSocket连接管理`);

      // Cloudflare Workers WebSocket URL - 支持多种格式
      const wsUrl =
        process.env.NEXT_PUBLIC_CLOUDFLARE_WS_URL ||
        process.env.NEXT_PUBLIC_WS_URL ||
        "http://localhost:8787";

      // 如果没有全局socket，创建新的
      if (!globalSocket) {
        console.log(`🆕 [${callbackId}] 创建新的全局WebSocket实例`);
        globalSocket = new CloudflareSocket(wsUrl);
        isShuttingDown = false; // 重置关闭状态
      }

      // 包装回调以更新连接状态
      const wrappedCallbacks: SocketCallbacks = {
        onConnect: () => {
          setConnectionStatus("已连接 (Cloudflare)");
          callbacksRef.current.onConnect();
        },
        onConnectError: (err) => {
          console.log(`❌ [${callbackId}] 连接错误:`, err);
          setConnectionStatus(`连接错误: ${err.message}`);
          callbacksRef.current.onConnectError(err);
        },
        onInit: (agents, time) => callbacksRef.current.onInit(agents, time),
        onTimeUpdate: (time) => callbacksRef.current.onTimeUpdate(time),
        onAgentTask: (task) => callbacksRef.current.onAgentTask(task),
        onConversationStart: (data) => callbacksRef.current.onConversationStart(data),
        onConversationEnd: (data) => callbacksRef.current.onConversationEnd(data),
        onConversationMessage: (data) => callbacksRef.current.onConversationMessage(data),
        onStopAgentMovement: (data) => callbacksRef.current.onStopAgentMovement(data),
        onAgentStateUpdate: (data) => callbacksRef.current.onAgentStateUpdate(data),
      };

      // 注册回调
      callbacksMap.set(callbackId, wrappedCallbacks);
      console.log(`📝 [${callbackId}] 注册回调，当前回调数: ${callbacksMap.size}`);

      // 如果还没有连接，开始连接
      if (!globalConnectionPromise && !isShuttingDown) {
        console.log(`🔌 [${callbackId}] 开始连接WebSocket`);
        globalConnectionPromise = globalSocket.connect().catch(error => {
          console.error(`❌ [${callbackId}] 全局连接失败:`, error);
          globalConnectionPromise = null;
          throw error;
        });
      }
    }

    function cleanup() {
      const callbackId = callbackIdRef.current;
      // 清理：移除回调
      console.log(`🧹 [${callbackId}] 清理回调`);
      callbacksMap.delete(callbackId);
      
      console.log(`📊 剩余回调数: ${callbacksMap.size}`);
      
      // 如果没有更多回调，清理全局socket
      if (callbacksMap.size === 0 && globalSocket) {
        console.log(`🗑️ [${callbackId}] 清理全局WebSocket连接`);
        globalSocket.disconnect();
        globalSocket = null;
        globalConnectionPromise = null;
        connectionAttempts = 0;
        isConnecting = false;
        isShuttingDown = false;
      }
    }
  }, []); // 空依赖数组确保只运行一次

  const reportTaskComplete = (
    agentId: number,
    status: AgentState["status"],
    position: { x: number; y: number }
  ) => {
    if (globalSocket) {
      globalSocket.emit("task_complete", {
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
    if (globalSocket) {
      globalSocket.emit("agentUpdate", {
        agentId,
        status,
        position,
      });
    }
  };

  const stopAgentMovement = (agentId: number) => {
    if (globalSocket) {
      globalSocket.emit("stopAgentMovement", { agentId });
    }
  };

  return {
    socket: globalSocket,
    connectionStatus,
    reportTaskComplete,
    updateAgent,
    stopAgentMovement,
  };
};