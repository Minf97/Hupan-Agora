import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema/agents";

// 获取所有agents
export async function GET() {
  try {
    const allAgents = await db.select().from(agents);
    console.log(allAgents, 'allAgents');
    return NextResponse.json(allAgents);
  } catch (error) {
    console.error("获取agents失败:", error);
    return NextResponse.json(
      { error: "获取agents失败" },
      { status: 500 }
    );
  }
}

// 创建新agent
export async function POST(request: NextRequest) {
  try {
    const { name, description, personality, backstory, goals, avatarUrl } = await request.json();

    if (!name || !personality) {
      return NextResponse.json(
        { error: "名称和性格描述是必需的" },
        { status: 400 }
      );
    }

    const newAgent = await db.insert(agents).values({
      name,
      description,
      personality,
      backstory,
      goals,
      avatarUrl,
    }).returning();

    return NextResponse.json(newAgent[0], { status: 201 });
  } catch (error) {
    console.error("创建agent失败:", error);
    return NextResponse.json(
      { error: "创建agent失败" },
      { status: 500 }
    );
  }
} 