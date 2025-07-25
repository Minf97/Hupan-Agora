// app/api/test-thoughts/route.ts - 测试思考记录功能

import { NextResponse } from 'next/server';
import { addThought } from '@/lib/thoughts-service';

// POST /api/test-thoughts - 添加测试思考记录
export async function POST() {
  try {
    // 创建一些测试数据
    const testThoughts = [
      {
        agentId: 1,
        agentName: '张三',
        type: 'inner_thought' as const,
        content: '我觉得今天天气不错，适合外出散步。',
        metadata: {
          confidence: 0.8,
          emotion: '愉快',
        },
      },
      {
        agentId: 1,
        agentName: '张三',
        type: 'decision' as const,
        content: '决定去公园里走走。',
        metadata: {
          reasoning: '天气好，心情也好',
          confidence: 0.9,
        },
      },
      {
        agentId: 2,
        agentName: '李四',
        type: 'conversation' as const,
        content: '你好，今天天气真不错！',
        metadata: {
          emotion: '友好',
          conversationId: 'conv_001',
        },
      },
    ];

    const results = [];
    for (const thought of testThoughts) {
      const result = await addThought(thought);
      results.push(result);
    }

    return NextResponse.json({
      success: true,
      message: '测试思考记录已添加',
      data: results,
    });
  } catch (error) {
    console.error('添加测试思考记录失败:', error);
    return NextResponse.json(
      { success: false, error: '添加测试思考记录失败' },
      { status: 500 }
    );
  }
}