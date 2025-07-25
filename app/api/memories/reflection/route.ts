// app/api/memories/reflection/route.ts - 生成反思记忆

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { thoughts } from '@/db/schema/thoughts';
import { memories } from '@/db/schema/memories';
import { eq, desc } from 'drizzle-orm';
import { generateEmbedding } from '@/lib/embeddings';
import OpenAI from 'openai';

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  baseURL: process.env.OPENAI_BASEURL,
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/memories/reflection - 为指定代理生成反思记忆
export async function POST(request: NextRequest) {
  try {
    const { agentId, thoughtCount = 10 } = await request.json();
    
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: '缺少代理ID' },
        { status: 400 }
      );
    }

    // 获取代理最近的思考记录
    const recentThoughts = await db
      .select({
        content: thoughts.content,
        type: thoughts.type,
        agentName: thoughts.agentName,
        createdAt: thoughts.createdAt,
      })
      .from(thoughts)
      .where(eq(thoughts.agentId, agentId))
      .orderBy(desc(thoughts.createdAt))
      .limit(thoughtCount);

    if (recentThoughts.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有找到思考记录' },
        { status: 404 }
      );
    }

    // 构造反思提示
    const thoughtsText = recentThoughts
      .map((t, i) => `${i + 1}. [${t.type}] ${t.content}`)
      .join('\n');

    const reflectionPrompt = `
作为AI代理 ${recentThoughts[0].agentName}，基于以下最近的思考和经历，生成一个深刻的反思：

最近的思考记录：
${thoughtsText}

请生成一个简洁但深刻的反思，要求：
1. 总结这些经历中的关键模式或主题
2. 提取可操作的洞察或学习
3. 体现个人成长或认知改变
4. 不超过150字
5. 以第一人称表达

反思内容：`;

    // 调用 OpenAI 生成反思
    const response = await openai.chat.completions.create({
      model: process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一个善于自我反思和总结的AI助手，能够从经历中提取深刻洞察和个人成长。',
        },
        {
          role: 'user',
          content: reflectionPrompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const reflectionContent = response.choices[0].message.content?.trim();

    if (!reflectionContent) {
      return NextResponse.json(
        { success: false, error: '无法生成反思内容' },
        { status: 500 }
      );
    }

    // 生成嵌入向量
    const embedding = await generateEmbedding(reflectionContent);

    // 保存反思记忆到数据库
    const [newReflection] = await db.insert(memories).values({
      agentId: agentId,
      content: reflectionContent,
      type: 'reflection',
      importance: 5, // 反思记忆具有最高重要性
      embedding: JSON.stringify(embedding),
    }).returning();

    return NextResponse.json({
      success: true,
      data: {
        id: newReflection.id,
        agentId: newReflection.agentId,
        content: newReflection.content,
        type: newReflection.type,
        importance: newReflection.importance,
        createdAt: newReflection.createdAt,
        thoughtsUsed: recentThoughts.length,
      },
    });

  } catch (error) {
    console.error('生成反思记忆失败:', error);
    return NextResponse.json(
      { success: false, error: '生成反思记忆失败' },
      { status: 500 }
    );
  }
}