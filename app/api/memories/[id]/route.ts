import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { memories } from "@/db/schema/memories";
import { eq } from "drizzle-orm";

// 获取单个记忆
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

    const memory = await db.select().from(memories).where(eq(memories.id, id)).limit(1);

    if (memory.length === 0) {
      return NextResponse.json(
        { error: "找不到记忆" },
        { status: 404 }
      );
    }

    return NextResponse.json(memory[0]);
  } catch (error) {
    console.error("获取记忆失败:", error);
    return NextResponse.json(
      { error: "获取记忆失败" },
      { status: 500 }
    );
  }
}

// 更新记忆
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

    const { importance } = await request.json();

    const updatedMemory = await db.update(memories)
      .set({
        importance,
        updatedAt: new Date()
      })
      .where(eq(memories.id, id))
      .returning();

    if (updatedMemory.length === 0) {
      return NextResponse.json(
        { error: "找不到记忆" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedMemory[0]);
  } catch (error) {
    console.error("更新记忆失败:", error);
    return NextResponse.json(
      { error: "更新记忆失败" },
      { status: 500 }
    );
  }
}

// 删除记忆
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

    const deletedMemory = await db.delete(memories)
      .where(eq(memories.id, id))
      .returning();

    if (deletedMemory.length === 0) {
      return NextResponse.json(
        { error: "找不到记忆" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "记忆已删除" });
  } catch (error) {
    console.error("删除记忆失败:", error);
    return NextResponse.json(
      { error: "删除记忆失败" },
      { status: 500 }
    );
  }
} 