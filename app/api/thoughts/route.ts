// app/api/thoughts/route.ts - 思考记录 API 路由

import { NextRequest, NextResponse } from 'next/server';
import { addThought, getRecentThoughts, clearAllThoughts } from '@/lib/thoughts-service';

// GET /api/thoughts - 获取最近的思考记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const thoughts = await getRecentThoughts(limit);
    
    return NextResponse.json({ 
      success: true, 
      data: thoughts 
    });
  } catch (error) {
    console.error('获取思考记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取思考记录失败' },
      { status: 500 }
    );
  }
}

// POST /api/thoughts - 添加新的思考记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, agentName, type, content, metadata } = body;
    
    if (!agentId || !agentName || !type || !content) {
      return NextResponse.json(
        { success: false, error: '缺少必需的字段' },
        { status: 400 }
      );
    }
    
    const thought = await addThought({
      agentId,
      agentName,
      type,
      content,
      metadata
    });
    
    return NextResponse.json({ 
      success: true, 
      data: thought 
    });
  } catch (error) {
    console.error('添加思考记录失败:', error);
    return NextResponse.json(
      { success: false, error: '添加思考记录失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/thoughts - 清空所有思考记录
export async function DELETE() {
  try {
    await clearAllThoughts();
    
    return NextResponse.json({ 
      success: true, 
      message: '所有思考记录已清空' 
    });
  } catch (error) {
    console.error('清空思考记录失败:', error);
    return NextResponse.json(
      { success: false, error: '清空思考记录失败' },
      { status: 500 }
    );
  }
}