"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Loader2, User, Bot, MessageSquare } from "lucide-react";

interface Message {
  id: number;
  agentId: number | null;
  senderId: string;
  senderType: "user" | "agent";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: number;
  title: string;
  messages: Message[];
}

interface Agent {
  id: number;
  name: string;
  avatarUrl?: string;
}

export default function ConversationPage() {
  const params = useParams();
  const conversationId = Number(params.id);
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载对话和消息
  useEffect(() => {
    const fetchConversation = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/conversations/${conversationId}`);
        
        if (!response.ok) {
          throw new Error("无法获取对话数据");
        }
        
        const data = await response.json();
        setConversation(data);
      } catch (error) {
        console.error("获取对话失败:", error);
        setError("无法加载对话。请稍后再试。");
      } finally {
        setLoading(false);
      }
    };

    const fetchAgents = async () => {
      try {
        const response = await fetch("/api/agents");
        
        if (!response.ok) {
          throw new Error("无法获取数字人数据");
        }
        
        const data = await response.json();
        setAgents(data);
        // 默认选择第一个agent
        if (data.length > 0) {
          setSelectedAgent(data[0]);
        }
      } catch (error) {
        console.error("获取数字人失败:", error);
      }
    };

    fetchConversation();
    fetchAgents();
  }, [conversationId]);

  // 滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 发送消息
  const sendMessage = async () => {
    if (!message.trim() || !selectedAgent) return;
    
    try {
      setSending(true);
      
      // 发送用户消息
      const userResponse = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          senderId: "user",
          senderType: "user",
          content: message,
        }),
      });

      if (!userResponse.ok) {
        throw new Error("发送消息失败");
      }

      // 获取更新后的对话
      const updatedConversationResponse = await fetch(`/api/conversations/${conversationId}`);
      if (!updatedConversationResponse.ok) {
        throw new Error("无法获取更新后的对话");
      }

      const updatedConversation = await updatedConversationResponse.json();
      setConversation(updatedConversation);
      setMessage("");
      
      // 模拟Agent回复（实际项目中这里应该调用AI服务）
      const agentResponse = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          senderId: `agent-${selectedAgent.id}`,
          senderType: "agent",
          content: `这是来自 ${selectedAgent.name} 的回复。在实际应用中，这里会根据记忆和个性生成回复。`,
        }),
      });

      if (!agentResponse.ok) {
        throw new Error("发送Agent回复失败");
      }

      // 再次获取更新后的对话
      const finalConversationResponse = await fetch(`/api/conversations/${conversationId}`);
      if (!finalConversationResponse.ok) {
        throw new Error("无法获取最终对话");
      }

      const finalConversation = await finalConversationResponse.json();
      setConversation(finalConversation);
    } catch (error) {
      console.error("消息交互失败:", error);
      setError("发送或接收消息失败。请稍后再试。");
    } finally {
      setSending(false);
    }
  };

  // 格式化日期
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 获取Agent名称
  const getAgentName = (agentId: number | null) => {
    if (!agentId) return "Unknown";
    const agent = agents.find(a => a.id === agentId);
    return agent ? agent.name : "Unknown";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="border-b p-4 flex items-center">
        <Button variant="ghost" asChild className="mr-2">
          <Link href="/conversations">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">
          {conversation ? conversation.title : "加载中..."}
        </h1>
      </div>

      {error ? (
        <div className="bg-destructive/10 text-destructive p-4">
          {error}
        </div>
      ) : null}

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">正在加载对话...</span>
          </div>
        ) : conversation?.messages && conversation.messages.length > 0 ? (
          <div className="space-y-4">
            {conversation.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.senderType === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    msg.senderType === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="flex items-center mb-1">
                    {msg.senderType === "agent" ? (
                      <Bot className="h-4 w-4 mr-1" />
                    ) : (
                      <User className="h-4 w-4 mr-1" />
                    )}
                    <span className="font-medium">
                      {msg.senderType === "user"
                        ? "你"
                        : getAgentName(msg.agentId)}
                    </span>
                    <span className="text-xs ml-2 opacity-70">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <p>{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-2" />
            <h3 className="text-lg font-medium">开始新对话</h3>
            <p className="max-w-md">
              选择一个数字人并发送消息开始对话。数字人会根据自己的记忆和个性回复你。
            </p>
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <div className="flex items-center mb-4">
          <span className="mr-2">与谁对话:</span>
          <select
            value={selectedAgent?.id || ""}
            onChange={(e) => {
              const agentId = Number(e.target.value);
              const agent = agents.find((a) => a.id === agentId) || null;
              setSelectedAgent(agent);
            }}
            className="border rounded p-1"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center">
          <Input
            placeholder="输入消息..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={sending}
            className="flex-1 mr-2"
          />
          <Button
            onClick={sendMessage}
            disabled={!message.trim() || sending || !selectedAgent}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="ml-2">发送</span>
          </Button>
        </div>
      </div>
    </div>
  );
} 