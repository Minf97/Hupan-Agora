import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema/agents";
import { eq } from "drizzle-orm";

// 获取单个Agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "无效的ID" },
        { status: 400 }
      );
    }

    const agent = await db.select().from(agents).where(eq(agents.id, id)).limit(1);

    if (agent.length === 0) {
      return NextResponse.json(
        { error: "找不到Agent" },
        { status: 404 }
      );
    }

    return NextResponse.json(agent[0]);
  } catch (error) {
    console.error("获取agent失败:", error);
    return NextResponse.json(
      { error: "获取agent失败" },
      { status: 500 }
    );
  }
}

// 更新Agent
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "无效的ID" },
        { status: 400 }
      );
    }

    const { name, email, bg, tags, chatbot_history, avatarUrl } = await request.json();

    const updatedAgent = await db.update(agents)
      .set({
        name,
        email,
        bg,
        tags: tags || [],
        chatbot_history: chatbot_history || [],
        avatarUrl,
        updatedAt: new Date()
      })
      .where(eq(agents.id, id))
      .returning();

    if (updatedAgent.length === 0) {
      return NextResponse.json(
        { error: "找不到Agent" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedAgent[0]);
  } catch (error) {
    console.error("更新agent失败:", error);
    return NextResponse.json(
      { error: "更新agent失败" },
      { status: 500 }
    );
  }
}

// 删除Agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "无效的ID" },
        { status: 400 }
      );
    }

    const deletedAgent = await db.delete(agents)
      .where(eq(agents.id, id))
      .returning();

    if (deletedAgent.length === 0) {
      return NextResponse.json(
        { error: "找不到Agent" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Agent已删除" });
  } catch (error) {
    console.error("删除agent失败:", error);
    return NextResponse.json(
      { error: "删除agent失败" },
      { status: 500 }
    );
  }
} 