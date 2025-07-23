import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { conversations } from "@/db/schema/conversations";
import { messages } from "@/db/schema/conversations";
import { eq } from "drizzle-orm";
import { desc } from "drizzle-orm";

// 获取单个对话和其消息
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "无效的ID" },
        { status: 400 }
      );
    }

    // 获取对话信息
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (conversation.length === 0) {
      return NextResponse.json(
        { error: "找不到对话" },
        { status: 404 }
      );
    }

    // 获取与该对话相关的所有消息，按时间排序
    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    return NextResponse.json({
      ...conversation[0],
      messages: conversationMessages,
    });
  } catch (error) {
    console.error("获取对话失败:", error);
    return NextResponse.json(
      { error: "获取对话失败" },
      { status: 500 }
    );
  }
}

// 更新对话标题
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "无效的ID" },
        { status: 400 }
      );
    }

    const { title } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: "标题是必需的" },
        { status: 400 }
      );
    }

    const updatedConversation = await db.update(conversations)
      .set({
        title,
        updatedAt: new Date()
      })
      .where(eq(conversations.id, id))
      .returning();

    if (updatedConversation.length === 0) {
      return NextResponse.json(
        { error: "找不到对话" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedConversation[0]);
  } catch (error) {
    console.error("更新对话失败:", error);
    return NextResponse.json(
      { error: "更新对话失败" },
      { status: 500 }
    );
  }
}

// 删除对话
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "无效的ID" },
        { status: 400 }
      );
    }

    // 先删除与该对话相关的所有消息
    await db.delete(messages)
      .where(eq(messages.conversationId, id));

    // 再删除对话本身
    const deletedConversation = await db.delete(conversations)
      .where(eq(conversations.id, id))
      .returning();

    if (deletedConversation.length === 0) {
      return NextResponse.json(
        { error: "找不到对话" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "对话已删除" });
  } catch (error) {
    console.error("删除对话失败:", error);
    return NextResponse.json(
      { error: "删除对话失败" },
      { status: 500 }
    );
  }
} 