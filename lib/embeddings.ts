import OpenAI from 'openai';

// 初始化OpenAI客户端
const openai = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 使用OpenAI的API将文本转换为嵌入向量
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('生成嵌入时出错:', error);
    throw new Error(`生成嵌入失败: ${error instanceof Error ? error.message : String(error)}`);
  }
} 