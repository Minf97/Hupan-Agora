import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema/conversations";
import { conversations } from "@/db/schema/conversations";
import { memories } from "@/db/schema/memories";
import { generateEmbedding } from "@/lib/embeddings";
import { eq } from "drizzle-orm";

// 添加消息到对话
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = parseInt(params.id);
    
    if (isNaN(conversationId)) {
      return NextResponse.json(
        { error: "无效的对话ID" },
        { status: 400 }
      );
    }

    // 检查对话是否存在
    const conversation = await db.select().from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (conversation.length === 0) {
      return NextResponse.json(
        { error: "找不到对话" },
        { status: 404 }
      );
    }

    const { agentId, content, senderId, senderType, metadata } = await request.json();

    if (!content || !senderId || !senderType) {
      return NextResponse.json(
        { error: "内容、发送者ID和发送者类型是必需的" },
        { status: 400 }
      );
    }

    // 添加消息
    const newMessage = await db.insert(messages).values({
      conversationId,
      agentId,
      senderId,
      senderType,
      content,
      metadata
    }).returning();

    // 如果是Agent的消息，则同时存储为记忆
    if (senderType === "agent" && agentId) {
      // 为内容生成嵌入向量
      const embedding = await generateEmbedding(content);

      // 存储为记忆
      await db.insert(memories).values({
        agentId,
        content,
        embedding,
        type: "conversation",
        importance: 2, // 设定对话记忆的重要性为中等
      });
    }

    return NextResponse.json(newMessage[0], { status: 201 });
  } catch (error) {
    console.error("添加消息失败:", error);
    return NextResponse.json(
      { error: "添加消息失败" },
      { status: 500 }
    );
  }
} 