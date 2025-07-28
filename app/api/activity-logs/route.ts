import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { activityLogs, NewActivityLog } from '@/db/schema';
import { desc, eq, and, or } from 'drizzle-orm';

// POST - 创建新的活动日志
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      agentId,
      agentName,
      content,
      targetAgentId,
      targetAgentName,
      conversationId,
      memoryId,
      metadata
    } = body;

    // 验证必需字段
    if (!type || !agentId || !agentName || !content) {
      return NextResponse.json(
        { error: '缺少必需字段: type, agentId, agentName, content' },
        { status: 400 }
      );
    }

    const newLog: NewActivityLog = {
      type,
      agentId,
      agentName,
      content,
      targetAgentId: targetAgentId || null,
      targetAgentName: targetAgentName || null,
      conversationId: conversationId || null,
      memoryId: memoryId || null,
      metadata: metadata || null,
    };

    const result = await db.insert(activityLogs).values(newLog).returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('创建活动日志失败:', error);
    return NextResponse.json(
      { error: '创建活动日志失败' },
      { status: 500 }
    );
  }
}

// GET - 获取活动日志
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = db.select().from(activityLogs);

    // 构建查询条件
    const conditions = [];
    
    if (agentId) {
      const agentIdNum = parseInt(agentId);
      // 查询与该agent相关的所有日志（作为主体或目标）
      conditions.push(
        or(
          eq(activityLogs.agentId, agentIdNum),
          eq(activityLogs.targetAgentId, agentIdNum)
        )
      );
    }

    if (type) {
      conditions.push(eq(activityLogs.type, type as any));
    }

    // 添加排序、限制和偏移
    let results;
    if (conditions.length > 0) {
      results = await db.select().from(activityLogs)
        .where(and(...conditions))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      results = await query
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit)
        .offset(offset);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('获取活动日志失败:', error);
    return NextResponse.json(
      { error: '获取活动日志失败' },
      { status: 500 }
    );
  }
}