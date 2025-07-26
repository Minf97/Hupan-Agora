import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema/agents";
import { eq } from "drizzle-orm";

// 聊天消息类型定义
interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}

// GET /api/agents/[id]/chat - 获取与指定代理的聊天历史
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = parseInt(params.id);
    if (isNaN(agentId)) {
      return NextResponse.json(
        { error: "无效的代理ID" },
        { status: 400 }
      );
    }

    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agent.length === 0) {
      return NextResponse.json(
        { error: "代理不存在" },
        { status: 404 }
      );
    }

    const chatHistory = agent[0].chatbot_history || [];
    
    return NextResponse.json({
      success: true,
      data: {
        agentId,
        agentName: agent[0].name,
        messages: chatHistory
      }
    });
  } catch (error) {
    console.error("获取聊天历史失败:", error);
    return NextResponse.json(
      { error: "获取聊天历史失败" },
      { status: 500 }
    );
  }
}

// POST /api/agents/[id]/chat - 发送消息给指定代理
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = parseInt(params.id);
    if (isNaN(agentId)) {
      return NextResponse.json(
        { error: "无效的代理ID" },
        { status: 400 }
      );
    }

    const { message } = await request.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: "消息内容不能为空" },
        { status: 400 }
      );
    }

    // 获取当前代理信息
    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agent.length === 0) {
      return NextResponse.json(
        { error: "代理不存在" },
        { status: 404 }
      );
    }

    const currentAgent = agent[0];
    const currentHistory = currentAgent.chatbot_history || [];

    // 创建用户消息
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message.trim(),
      timestamp: Date.now()
    };

    // 生成AI回复
    const agentReply = await generateAgentReply(currentAgent.name, message, currentAgent.bg);
    const agentMessage: ChatMessage = {
      id: `agent_${Date.now()}`,
      role: 'agent',
      content: agentReply,
      timestamp: Date.now() + 1000 // 稍微延迟一点，模拟思考时间
    };

    // 更新聊天历史（保留最近50条消息）
    const updatedHistory = [...currentHistory, userMessage, agentMessage].slice(-50);

    // 更新数据库
    await db
      .update(agents)
      .set({ 
        chatbot_history: updatedHistory,
        updatedAt: new Date()
      })
      .where(eq(agents.id, agentId));

    return NextResponse.json({
      success: true,
      data: {
        userMessage,
        agentMessage,
        agentName: currentAgent.name
      }
    });
  } catch (error) {
    console.error("发送消息失败:", error);
    return NextResponse.json(
      { error: "发送消息失败" },
      { status: 500 }
    );
  }
}

// AI回复生成函数 - 使用Moonshot API
async function generateAgentReply(agentName: string, userMessage: string, agentBackground?: string): Promise<string> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_OPENAI_BASE_URL;
    const model = process.env.NEXT_PUBLIC_OPENAI_MODEL || 'moonshot-v1-8k';

    if (!apiKey || !baseUrl) {
      console.error('Missing OpenAI API configuration');
      return `${agentName}: 抱歉，我现在无法回复，请稍后再试。`;
    }

    // 构建系统提示词
    const systemPrompt = `你是${agentName}，一个AI数字人。${agentBackground ? `你的背景是：${agentBackground}` : ''} 
请以${agentName}的身份回复用户的消息。保持友好、自然的对话风格，并体现你的个性。回复要简洁明了，通常1-3句话即可。`;

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('AI API request failed:', response.status, response.statusText);
      return `${agentName}: 抱歉，我现在有点忙，请稍后再试。`;
    }

    const data = await response.json();
    const aiReply = data.choices?.[0]?.message?.content;

    if (!aiReply) {
      console.error('No response from AI API');
      return `${agentName}: 我现在有点困惑，能再说一遍吗？`;
    }

    return aiReply.trim();

  } catch (error) {
    console.error('Error generating AI reply:', error);
    // 降级到简单回复
    return generateSimpleReply(agentName, userMessage);
  }
}

// 简单的降级回复函数
function generateSimpleReply(agentName: string, userMessage: string): string {
  const responses = [
    `你好！我是${agentName}，很高兴和你聊天。`,
    `${agentName}在这里，有什么我可以帮助你的吗？`,
    `作为${agentName}，我觉得你说得很有趣。`,
    `嗯，让我想想... 作为${agentName}，我认为这是个好问题。`,
    `${agentName}表示理解，请告诉我更多。`,
    `这很有意思！${agentName}想了解更多细节。`,
    `${agentName}觉得我们可以继续深入讨论这个话题。`
  ];

  // 根据用户消息内容选择更合适的回复
  if (userMessage.includes('你好') || userMessage.includes('hello')) {
    return `你好！我是${agentName}，很高兴认识你！`;
  }
  
  if (userMessage.includes('谢谢') || userMessage.includes('thank')) {
    return `不客气！${agentName}很乐意帮助你。`;
  }
  
  if (userMessage.includes('再见') || userMessage.includes('bye')) {
    return `再见！${agentName}期待下次和你聊天。`;
  }

  // 随机选择一个回复
  const randomIndex = Math.floor(Math.random() * responses.length);
  return responses[randomIndex];
}