"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAgentStore } from "@/store/agents";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ArrowLeft, Loader2 } from "lucide-react";

// 表单验证模式
const agentFormSchema = z.object({
  name: z.string().min(2, {
    message: "名字至少需要2个字符",
  }),
  description: z.string().optional(),
  personality: z.string().min(10, {
    message: "性格描述至少需要10个字符",
  }),
  backstory: z.string().optional(),
  goals: z.string().optional(),
  avatarUrl: z.string().url({ message: "请输入有效的URL" }).optional().or(z.literal("")),
});

type AgentFormValues = z.infer<typeof agentFormSchema>;

export default function NewAgentPage() {
  const router = useRouter();
  const { addAgent, loading } = useAgentStore();
  const [error, setError] = useState("");

  // 默认值
  const defaultValues: AgentFormValues = {
    name: "",
    description: "",
    personality: "",
    backstory: "",
    goals: "",
    avatarUrl: "",
  };

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues,
  });

  async function onSubmit(data: AgentFormValues) {
    try {
      setError("");
      const newAgent = await addAgent(data);
      
      if (newAgent) {
        router.push(`/agents/${newAgent.id}`);
        router.refresh();
      }
    } catch (err) {
      console.error("创建数字人时出错:", err);
      setError(err instanceof Error ? err.message : "创建数字人时出现未知错误");
    }
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
        <h1 className="text-3xl font-bold">创建新数字人</h1>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-6">
          {error}
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名字</FormLabel>
                  <FormControl>
                    <Input placeholder="输入数字人的名字" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>简介</FormLabel>
                  <FormControl>
                    <Input placeholder="简短介绍这个数字人" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="personality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>性格特点</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="详细描述这个数字人的性格、行为方式和说话风格"
                      className="h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="backstory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>背景故事</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="这个数字人的过去、经历和记忆"
                      className="h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="goals"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>目标和动机</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="这个数字人想要什么，追求什么目标"
                      className="h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="avatarUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>头像URL</FormLabel>
                  <FormControl>
                    <Input placeholder="头像图片的链接（可选）" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-4">
              <Button variant="outline" asChild>
                <Link href="/agents">取消</Link>
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                创建数字人
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
} 