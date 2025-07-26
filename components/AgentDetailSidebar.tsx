"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import ChatSidebar from "@/components/ChatSidebar";

interface AgentDetailSidebarProps {
  agentId: number;
  onClose: () => void;
  agents: any[];
}

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

export default function AgentDetailSidebar({
  agentId,
  onClose,
  agents,
}: AgentDetailSidebarProps) {
  const [agentData, setAgentData] = useState<any>(null);
  const [agentThoughts, setAgentThoughts] = useState<ThoughtRecord[]>([]);
  const [loadingThoughts, setLoadingThoughts] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const agent = agents.find((a) => a.id === agentId);

  useEffect(() => {
    const fetchAgentData = async () => {
      try {
        const response = await fetch(`/api/agents/${agentId}`);
        if (response.ok) {
          const data = await response.json();
          setAgentData(data);
        }
      } catch (error) {
        console.error("Failed to fetch agent data:", error);
      }
    };

    const fetchAgentThoughts = async () => {
      setLoadingThoughts(true);
      try {
        const response = await fetch(`/api/thoughts/agent/${agentId}?limit=10`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setAgentThoughts(result.data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch agent thoughts:", error);
      } finally {
        setLoadingThoughts(false);
      }
    };

    if (agentId) {
      fetchAgentData();
      fetchAgentThoughts();
    }
  }, [agentId]);

  if (!agent) return null;

  return (
    <>
      <div className="fixed right-0 top-0 w-[29vw] h-[100vh] bg-white shadow-2xl z-50 border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Agent 详情</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="w-8 h-8 rounded-full hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Avatar and Basic Info */}
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-300 rounded-full mx-auto mb-4 flex items-center justify-center text-gray-600 text-sm">
              头像
            </div>
            <h1 className="text-2xl font-bold mb-2">{agent.name}</h1>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 justify-center">
            {agentData?.tags &&
              agentData.tags.length > 0 &&
              agentData.tags.map((tag: string, index: number) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full"
                >
                  {tag}
                </Badge>
              ))}
          </div>

          {/* Current Status */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">📍 当前状态</h4>
            <div className="space-y-2 text-sm">
              <p className="text-blue-700">
                状态:{" "}
                <span className="font-medium">
                  {agent.status === "talking"
                    ? "💬 交谈中"
                    : agent.status === "walking"
                    ? "🚶 行走中"
                    : agent.status === "seeking"
                    ? "🔍 寻找中"
                    : "😴 空闲"}
                </span>
              </p>
              <p className="text-blue-700">
                位置: ({Math.round(agent.position.x)},{" "}
                {Math.round(agent.position.y)})
              </p>
              {agent.talkingWith && (
                <p className="text-blue-700">
                  正在交谈:{" "}
                  <span className="font-medium">
                    {agents.find((a) => a.id === agent.talkingWith)?.name}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Memory Section */}
          <div>
            <h3 className="font-medium text-gray-800 mb-3">Memory</h3>
            <ScrollArea className="h-32 bg-gray-50 rounded-lg p-3">
              {loadingThoughts ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  加载记忆中...
                </div>
              ) : agentThoughts.length > 0 ? (
                <div className="text-sm text-gray-600 space-y-3">
                  {agentThoughts.map((thought) => (
                    <div
                      key={thought.id}
                      className="border-b border-gray-200 pb-2 last:border-b-0"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs text-gray-500 font-medium">
                          {thought.type === "inner_thought" && "💭 内心想法"}
                          {thought.type === "decision" && "🎯 决策"}
                          {thought.type === "conversation" && "💬 对话"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(thought.timestamp).toLocaleTimeString(
                            "zh-CN",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </span>
                      </div>
                      <p className="text-gray-700 leading-relaxed">
                        {thought.content}
                      </p>
                      {thought.metadata?.emotion && (
                        <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          😊 {thought.metadata.emotion}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 text-center py-4">
                  暂无记忆记录
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button className="w-full bg-black text-white hover:bg-gray-800 rounded-xl py-3 text-base">
              {agent.name}
            </Button>
            <Button
              variant="outline"
              className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl py-3 text-base"
            >
              历史记录
            </Button>
            <Button
              variant="outline"
              className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl py-3 text-base"
              onClick={() => setShowChat(true)}
            >
              和{agent.name}聊天
            </Button>
          </div>

          {/* Additional Info */}
          {/* {agentData?.email && (
            <div className="pt-4 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">{agentData.email}</p>
            </div>
          )} */}
        </div>
      </ScrollArea>
    </div>

    {/* Chat Sidebar */}
    {showChat && (
      <ChatSidebar
        agentId={agentId}
        agentName={agent.name}
        onClose={() => setShowChat(false)}
      />
    )}
    </>
  );
}
