import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { generateEmbedding } from "@/lib/embeddings";
import { sql } from "drizzle-orm";
import { VECTOR_DIMENSIONS } from "@/db/schema/memories";

// 记忆语义搜索
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const agentIdParam = searchParams.get('agentId');
    const limitParam = searchParams.get('limit');

    if (!query) {
      return NextResponse.json(
        { error: "必须提供搜索查询参数 'q'" },
        { status: 400 }
      );
    }

    // 将搜索查询转换为嵌入向量
    const queryEmbedding = await generateEmbedding(query);
    
    // 默认限制为5条结果
    const limit = limitParam ? parseInt(limitParam) : 5;

    // 构建SQL查询，使用原始SQL实现记忆搜索
    let sqlQuery = sql`
      SELECT 
        id, 
        agent_id as "agentId", 
        content, 
        type, 
        importance, 
        created_at as "createdAt", 
        1 - (embedding <=> ${JSON.stringify(queryEmbedding)}) as similarity
      FROM memories
      ${agentIdParam ? sql`WHERE agent_id = ${parseInt(agentIdParam) || 0}` : sql``}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;

    const results = await db.execute(sqlQuery);

    return NextResponse.json(results);
  } catch (error) {
    console.error("搜索记忆失败:", error);
    return NextResponse.json(
      { error: "搜索记忆失败" },
      { status: 500 }
    );
  }
} 