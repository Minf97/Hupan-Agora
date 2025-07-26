"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash, Pencil, Brain, MessageCircle, Loader2 } from "lucide-react";

interface Agent {
  id: number;
  name: string;
  email?: string;
  backstory?: string;
  goals?: string;
  bg?: string;
  avatarUrl?: string;
  createdAt: string;
}

interface Memory {
  id: number;
  agentId: number;
  content: string;
  type: string;
  importance: number;
  createdAt: string;
}

export default function AgentPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = Number(params.id);
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // 加载数字人信息
  useEffect(() => {
    const fetchAgent = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/agents/${agentId}`);
        
        if (!response.ok) {
          throw new Error("无法获取数字人数据");
        }
        
        const data = await response.json();
        setAgent(data);
      } catch (error) {
        console.error("获取数字人失败:", error);
        setError("无法加载数字人。请稍后再试。");
      } finally {
        setLoading(false);
      }
    };

    // 加载数字人的记忆
    const fetchMemories = async () => {
      try {
        setMemoriesLoading(true);
        const response = await fetch(`/api/memories?agentId=${agentId}`);
        
        if (!response.ok) {
          throw new Error("无法获取记忆数据");
        }
        
        const data = await response.json();
        setMemories(data);
      } catch (error) {
        console.error("获取记忆失败:", error);
      } finally {
        setMemoriesLoading(false);
      }
    };

    fetchAgent();
    fetchMemories();
  }, [agentId]);

  // 删除数字人
  const deleteAgent = async () => {
    if (!confirm("确定要删除这个数字人吗？此操作不可撤销。")) {
      return;
    }
    
    try {
      setDeleting(true);
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("删除失败");
      }
      
      router.push("/agents");
      router.refresh();
    } catch (error) {
      console.error("删除数字人失败:", error);
      setError("删除失败，请稍后再试");
      setDeleting(false);
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

  // 开始新对话
  const startConversation = async () => {
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `与 ${agent?.name || "数字人"} 的对话`,
        }),
      });

      if (!response.ok) {
        throw new Error("无法创建新对话");
      }

      const newConversation = await response.json();
      router.push(`/conversations/${newConversation.id}`);
    } catch (error) {
      console.error("创建对话失败:", error);
      setError("无法创建新对话。请稍后再试。");
    }
  };

  // 获取记忆类型的友好名称
  const getMemoryTypeName = (type: string) => {
    const types: Record<string, string> = {
      observation: "观察",
      thought: "思考",
      conversation: "对话",
      reflection: "反思",
    };
    return types[type] || type;
  };

  // 获取记忆重要性的颜色
  const getImportanceColor = (importance: number) => {
    switch (importance) {
      case 1:
        return "bg-muted";
      case 2:
        return "bg-blue-100 dark:bg-blue-900";
      case 3:
        return "bg-yellow-100 dark:bg-yellow-900";
      case 4:
      case 5:
        return "bg-red-100 dark:bg-red-900";
      default:
        return "bg-muted";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">正在加载数字人...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
        </div>
        <Button asChild className="mt-4">
          <Link href="/agents">返回数字人列表</Link>
        </Button>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">找不到数字人</h2>
          <p className="text-muted-foreground mb-4">
            无法找到ID为{agentId}的数字人
          </p>
          <Button asChild>
            <Link href="/agents">返回数字人列表</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" asChild className="mr-2">
          <Link href="/agents">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Link>
        </Button>
        <h1 className="text-3xl font-bold flex-grow">{agent.name}</h1>
        <div className="flex space-x-2">
          <Button variant="outline" asChild>
            <Link href={`/agents/${agentId}/edit`}>
              <Pencil className="h-4 w-4 mr-2" />
              编辑
            </Link>
          </Button>
          <Button variant="destructive" onClick={deleteAgent} disabled={deleting}>
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash className="h-4 w-4 mr-2" />
            )}
            删除
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Brain className="h-5 w-5 mr-2" /> 背景信息
            </h2>
            <p className="whitespace-pre-line">{agent.bg || "暂无背景信息"}</p>
          </div>

          {agent.backstory && (
            <div className="bg-card rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4">背景故事</h2>
              <p className="whitespace-pre-line">{agent.backstory}</p>
            </div>
          )}

          {agent.goals && (
            <div className="bg-card rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4">目标和动机</h2>
              <p className="whitespace-pre-line">{agent.goals}</p>
            </div>
          )}

          <div className="bg-card rounded-lg p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">记忆</h2>
              <Button onClick={() => setMemoriesLoading(true)}>刷新</Button>
            </div>

            {memoriesLoading ? (
              <div className="flex justify-center items-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">加载记忆中...</span>
              </div>
            ) : memories.length === 0 ? (
              <div className="text-center p-8 bg-muted/20 rounded-lg">
                <p>暂无记忆</p>
                <p className="text-muted-foreground text-sm mt-2">
                  随着数字人交互和思考，记忆将在此处显示
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {memories.slice(0, 10).map((memory) => (
                  <div
                    key={memory.id}
                    className={`p-3 rounded-md ${getImportanceColor(memory.importance)}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium">
                        {getMemoryTypeName(memory.type)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(memory.createdAt)}
                      </span>
                    </div>
                    <p>{memory.content}</p>
                  </div>
                ))}
                {memories.length > 10 && (
                  <div className="text-center mt-4">
                    <p className="text-sm text-muted-foreground">
                      显示最近的10条记忆，共 {memories.length} 条记忆
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card rounded-lg p-6 shadow-sm text-center">
            <div className="mb-4">
              {agent.avatarUrl ? (
                <img
                  src={agent.avatarUrl}
                  alt={agent.name}
                  className="h-32 w-32 rounded-full mx-auto object-cover"
                />
              ) : (
                <div className="h-32 w-32 rounded-full bg-primary/20 flex items-center justify-center text-4xl font-bold text-primary mx-auto">
                  {agent.name.charAt(0)}
                </div>
              )}
            </div>

            <div className="mb-6">
              {agent.email && (
                <p className="text-muted-foreground">{agent.email}</p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                创建于 {formatDate(agent.createdAt)}
              </p>
            </div>

            <Button className="w-full" onClick={startConversation}>
              <MessageCircle className="h-4 w-4 mr-2" />
              开始对话
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 