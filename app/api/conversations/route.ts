import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { conversations } from "@/db/schema/conversations";

// 获取所有对话
export async function GET() {
  try {
    const allConversations = await db.select().from(conversations);
    return NextResponse.json(allConversations);
  } catch (error) {
    console.error("获取对话失败:", error);
    return NextResponse.json(
      { error: "获取对话失败" },
      { status: 500 }
    );
  }
}

// 创建新对话
export async function POST(request: NextRequest) {
  try {
    const { title } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: "标题是必需的" },
        { status: 400 }
      );
    }

    const newConversation = await db.insert(conversations).values({
      title,
    }).returning();

    return NextResponse.json(newConversation[0], { status: 201 });
  } catch (error) {
    console.error("创建对话失败:", error);
    return NextResponse.json(
      { error: "创建对话失败" },
      { status: 500 }
    );
  }
} 