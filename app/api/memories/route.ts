import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { memories } from "@/db/schema/memories";
import { generateEmbedding } from "@/lib/embeddings";
import { eq } from "drizzle-orm";

// 获取所有记忆
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (agentId) {
      const id = parseInt(agentId);
      if (isNaN(id)) {
        return NextResponse.json(
          { error: "无效的Agent ID" },
          { status: 400 }
        );
      }

      const agentMemories = await db.select().from(memories).where(eq(memories.agentId, id));
      return NextResponse.json(agentMemories);
    }

    const allMemories = await db.select().from(memories);
    return NextResponse.json(allMemories);
  } catch (error) {
    console.error("获取记忆失败:", error);
    return NextResponse.json(
      { error: "获取记忆失败" },
      { status: 500 }
    );
  }
}

// 创建新记忆
export async function POST(request: NextRequest) {
  try {
    const { agentId, content, type, importance } = await request.json();

    if (!agentId || !content || !type) {
      return NextResponse.json(
        { error: "Agent ID、内容和类型是必需的" },
        { status: 400 }
      );
    }

    // 为内容生成嵌入向量
    const embedding = await generateEmbedding(content);

    const newMemory = await db.insert(memories).values({
      agentId,
      content,
      embedding,
      type,
      importance: importance || 1,
    }).returning();

    console.log(newMemory, "newMemory");
    

    return NextResponse.json(newMemory[0], { status: 201 });
  } catch (error) {
    console.error("创建记忆失败:", error);
    return NextResponse.json(
      { error: "创建记忆失败" },
      { status: 500 }
    );
  }
}