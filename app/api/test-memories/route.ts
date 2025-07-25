// app/api/test-memories/route.ts - 测试记忆功能

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { memories } from '@/db/schema/memories';
import { generateEmbedding } from '@/lib/embeddings';

// POST /api/test-memories - 添加测试记忆
export async function POST() {
  try {
    // 创建一些测试记忆数据
    const testMemories = [
      {
        agentId: 1,
        content: '我注意到公园里的樱花开始盛开了，春天真的到了。',
        type: 'observation',
        importance: 2,
      },
      {
        agentId: 1,
        content: '我决定每天早晨都要去公园散步，这对我的身心健康很有益。',
        type: 'goal',
        importance: 4,
      },
      {
        agentId: 1,
        content: '与李四的对话让我感到很愉快，我们聊了很多关于生活的话题。',
        type: 'conversation',
        importance: 3,
      },
      {
        agentId: 1,
        content: '我发现自己在与人交流时更加自信了，这可能与我最近的积极心态有关。',
        type: 'reflection',
        importance: 5,
      },
      {
        agentId: 2,
        content: '今天天气真好，阳光明媚，适合外出活动。',
        type: 'observation',
        importance: 1,
      },
    ];

    const results = [];
    
    for (const memoryData of testMemories) {
      // 生成嵌入向量
      const embedding = await generateEmbedding(memoryData.content);
      
      // 插入数据库
      const [insertedMemory] = await db.insert(memories).values({
        ...memoryData,
        embedding: JSON.stringify(embedding),
      }).returning();
      
      results.push(insertedMemory);
    }

    return NextResponse.json({
      success: true,
      message: '测试记忆已添加',
      data: results,
    });
  } catch (error) {
    console.error('添加测试记忆失败:', error);
    return NextResponse.json(
      { success: false, error: '添加测试记忆失败' },
      { status: 500 }
    );
  }
}