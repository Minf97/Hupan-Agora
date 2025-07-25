// app/api/thoughts/agent/[agentId]/route.ts - 按代理获取思考记录

import { NextRequest, NextResponse } from 'next/server';
import { getThoughtsByAgent, clearThoughtsByAgent } from '@/lib/thoughts-service';

// GET /api/thoughts/agent/[agentId] - 获取指定代理的思考记录
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const agentId = parseInt(params.agentId);
    if (isNaN(agentId)) {
      return NextResponse.json(
        { success: false, error: '无效的代理ID' },
        { status: 400 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const thoughts = await getThoughtsByAgent(agentId, limit);
    
    return NextResponse.json({ 
      success: true, 
      data: thoughts 
    });
  } catch (error) {
    console.error('获取代理思考记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取代理思考记录失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/thoughts/agent/[agentId] - 清空指定代理的思考记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const agentId = parseInt(params.agentId);
    if (isNaN(agentId)) {
      return NextResponse.json(
        { success: false, error: '无效的代理ID' },
        { status: 400 }
      );
    }
    
    await clearThoughtsByAgent(agentId);
    
    return NextResponse.json({ 
      success: true, 
      message: `代理 ${agentId} 的思考记录已清空` 
    });
  } catch (error) {
    console.error('清空代理思考记录失败:', error);
    return NextResponse.json(
      { success: false, error: '清空代理思考记录失败' },
      { status: 500 }
    );
  }
}