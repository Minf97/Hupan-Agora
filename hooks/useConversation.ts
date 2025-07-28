// hooks/useConversation.ts
import { useState } from "react";
import { AgentState } from "@/lib/map-config";

interface ConversationData {
  id: string;
  agent1: number;
  agent1Name: string;
  agent2: number;
  agent2Name: string;
  startTime: number;
  messages: any[];
}

interface ConversationMessage {
  conversationId: string;
  speaker: string;
  content: string;
  timestamp: number;
}

export const useConversation = () => {
  const [activeConversations, setActiveConversations] = useState(new Map<string, ConversationData>());
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);

  const handleConversationStart = (
    data: any,
    setAgents: (updater: (prev: AgentState[]) => AgentState[]) => void
  ) => {
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

    // 对话开始时不再生成假消息，等待来自 Worker 的真实 AI 对话
    console.log(`🎭 对话开始: ${agent1Name} ↔ ${agent2Name}，等待 AI 生成真实对话内容...`);
  };

  const handleConversationEnd = (
    data: any,
    setAgents: (updater: (prev: AgentState[]) => AgentState[]) => void,
    clearConversationState?: (agent1Id: number, agent2Id: number) => void
  ) => {
    const { conversationId, agent1, agent2, messages } = data;

    console.log(`🔚 对话结束: Agent ${agent1} ↔ Agent ${agent2}`);

    // 清除动画系统中的对话状态
    if (clearConversationState) {
      clearConversationState(agent1, agent2);
    }

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
  };

  const handleConversationMessage = (data: any) => {
    const { conversationId, speaker, content, timestamp } = data;
    
    const newMessage: ConversationMessage = {
      conversationId,
      speaker,
      content,
      timestamp: timestamp || Date.now()
    };

    // 添加新消息到消息列表
    setConversationMessages((prev) => [...prev, newMessage]);

    // 更新活跃对话中的消息
    setActiveConversations((prev) => {
      const newMap = new Map(prev);
      const conversation = newMap.get(conversationId);
      if (conversation) {
        newMap.set(conversationId, {
          ...conversation,
          messages: [...conversation.messages, newMessage]
        });
      }
      return newMap;
    });
  };

  return {
    activeConversations,
    conversationMessages,
    handleConversationStart,
    handleConversationEnd,
    handleConversationMessage,
  };
};