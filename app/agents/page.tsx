"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";

interface Agent {
  id: number;
  name: string;
  description: string;
  personality: string;
  avatarUrl?: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 加载数字人列表
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/agents");
        
        if (!response.ok) {
          throw new Error("无法获取数字人数据");
        }
        
        const data = await response.json();
        setAgents(data);
      } catch (error) {
        console.error("获取数字人失败:", error);
        setError("无法加载数字人。请稍后再试。");
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">小镇居民</h1>
        <Link href="/agents/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> 创建新居民
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">正在加载数字人...</span>
        </div>
      ) : error ? (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center p-12 bg-muted/40 rounded-lg">
          <h3 className="text-xl font-medium mb-2">暂无数字人</h3>
          <p className="text-muted-foreground mb-6">创建您的第一个数字人以开始体验</p>
          <Link href="/agents/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> 创建数字人
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link href={`/agents/${agent.id}`}>
      <div className="bg-card border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
        <div className="h-36 bg-gradient-to-r from-primary/10 to-primary/5 flex items-center justify-center">
          {agent.avatarUrl ? (
            <img
              src={agent.avatarUrl}
              alt={agent.name}
              className="h-24 w-24 rounded-full object-cover"
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
              {agent.name.charAt(0)}
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-lg">{agent.name}</h3>
          <p className="text-muted-foreground text-sm line-clamp-2 mt-1">
            {agent.description || agent.personality.substring(0, 100) + "..."}
          </p>
        </div>
      </div>
    </Link>
  );
} 