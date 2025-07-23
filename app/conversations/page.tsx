"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquareText, Loader2, Calendar } from "lucide-react";

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 加载对话列表
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/conversations");
        
        if (!response.ok) {
          throw new Error("无法获取对话数据");
        }
        
        const data = await response.json();
        setConversations(data);
      } catch (error) {
        console.error("获取对话失败:", error);
        setError("无法加载对话列表。请稍后再试。");
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, []);

  // 创建新对话
  const createNewConversation = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `对话 ${new Date().toLocaleString("zh-CN")}`,
        }),
      });

      if (!response.ok) {
        throw new Error("无法创建新对话");
      }

      const newConversation = await response.json();
      window.location.href = `/conversations/${newConversation.id}`;
    } catch (error) {
      console.error("创建对话失败:", error);
      setError("无法创建新对话。请稍后再试。");
      setLoading(false);
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">对话列表</h1>
        <Button onClick={createNewConversation} disabled={loading}>
          <Plus className="mr-2 h-4 w-4" /> 新对话
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">正在加载对话...</span>
        </div>
      ) : error ? (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center p-12 bg-muted/40 rounded-lg">
          <h3 className="text-xl font-medium mb-2">暂无对话</h3>
          <p className="text-muted-foreground mb-6">创建一个新对话开始聊天</p>
          <Button onClick={createNewConversation}>
            <Plus className="mr-2 h-4 w-4" /> 开始新对话
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/conversations/${conversation.id}`}
              className="block"
            >
              <div className="border rounded-lg p-4 hover:bg-accent/20 transition-colors flex items-center">
                <div className="bg-primary/10 p-3 rounded-full mr-4">
                  <MessageSquareText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-grow">
                  <h3 className="font-medium">{conversation.title}</h3>
                  <div className="flex items-center text-sm text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDate(conversation.createdAt)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
} 