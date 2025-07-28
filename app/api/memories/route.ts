// app/api/memories/route.ts - Agent 记忆 API 路由

import { NextRequest, NextResponse } from 'next/server';

// 临时记忆存储（应该连接到数据库）
let memories: any[] = [];

// GET /api/memories - 获取记忆
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    let filteredMemories = memories;
    if (agentId) {
      filteredMemories = memories.filter(m => m.agentId === parseInt(agentId));
    }
    
    const recentMemories = filteredMemories
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    
    return NextResponse.json({ 
      success: true, 
      data: recentMemories 
    });
  } catch (error) {
    console.error('获取记忆失败:', error);
    return NextResponse.json(
      { success: false, error: '获取记忆失败' },
      { status: 500 }
    );
  }
}

// POST /api/memories - 创建新记忆
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('接收到记忆数据:', body);
    
    const { agentId, type, content, importance, participants, relatedEventId } = body;
    
    if (!agentId || !type || !content) {
      return NextResponse.json(
        { success: false, error: '缺少必需的字段: agentId, type, content' },
        { status: 400 }
      );
    }
    
    const memory = {
      id: Date.now() + Math.random(),
      agentId: parseInt(agentId),
      type,
      content,
      importance: importance || 1,
      participants: participants || [],
      relatedEventId,
      timestamp: Date.now(),
      createdAt: new Date(),
    };
    
    memories.push(memory);
    
    // 保持最新的 1000 条记忆
    if (memories.length > 1000) {
      memories = memories.slice(-1000);
    }
    
    console.log(`💾 新记忆已创建: Agent ${agentId} - ${type}`);
    
    return NextResponse.json({ 
      success: true, 
      data: memory 
    });
  } catch (error) {
    console.error('创建记忆失败:', error);
    return NextResponse.json(
      { success: false, error: '创建记忆失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/memories - 清空记忆
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    
    if (agentId) {
      // 清空特定 Agent 的记忆
      memories = memories.filter(m => m.agentId !== parseInt(agentId));
    } else {
      // 清空所有记忆
      memories = [];
    }
    
    return NextResponse.json({ 
      success: true, 
      message: agentId ? `Agent ${agentId} 的记忆已清空` : '所有记忆已清空'
    });
  } catch (error) {
    console.error('清空记忆失败:', error);
    return NextResponse.json(
      { success: false, error: '清空记忆失败' },
      { status: 500 }
    );
  }
}