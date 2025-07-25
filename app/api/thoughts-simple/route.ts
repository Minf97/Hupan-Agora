// app/api/thoughts-simple/route.ts - 简化版思考记录 API (不需要嵌入向量)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { thoughts } from '@/db/schema/thoughts';
import { desc } from 'drizzle-orm';

// GET /api/thoughts-simple - 获取最近的思考记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const recentThoughts = await db
      .select()
      .from(thoughts)
      .orderBy(desc(thoughts.createdAt))
      .limit(limit);
    
    return NextResponse.json({ 
      success: true, 
      data: recentThoughts,
      count: recentThoughts.length
    });
  } catch (error) {
    console.error('获取思考记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取思考记录失败', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/thoughts-simple - 添加新的思考记录 (简化版)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, agentName, type, content } = body;
    
    if (!agentId || !agentName || !type || !content) {
      return NextResponse.json(
        { success: false, error: '缺少必需的字段' },
        { status: 400 }
      );
    }
    
    // 直接插入，不进行复杂的转换
    const [newThought] = await db.insert(thoughts).values({
      agentId: parseInt(agentId),
      agentName,
      type,
      content,
      confidence: null,
      reasoning: null,
      shouldInitiateChat: 0,
      emotion: null,
      conversationId: null,
    }).returning();
    
    return NextResponse.json({ 
      success: true, 
      data: {
        id: newThought.id.toString(),
        agentId: newThought.agentId,
        agentName: newThought.agentName,
        type: newThought.type,
        content: newThought.content,
        timestamp: newThought.createdAt.getTime(),
      }
    });
  } catch (error) {
    console.error('添加思考记录失败:', error);
    return NextResponse.json(
      { success: false, error: '添加思考记录失败', details: String(error) },
      { status: 500 }
    );
  }
}