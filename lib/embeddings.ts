import OpenAI from 'openai';

// 初始化OpenAI客户端
const openai = new OpenAI({
  baseURL: process.env.NEXT_PUBLIC_OPENAI_BASE_URL 
    ? `${process.env.NEXT_PUBLIC_OPENAI_BASE_URL}/v1`
    : 'https://api.openai.com/v1',
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

/**
 * 使用OpenAI的API将文本转换为嵌入向量
 * 注意：此函数不再包含任何 mock 或假数据，必须连接真实的 API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  console.log(process.env.NEXT_PUBLIC_OPENAI_BASE_URL, "OPENAI_BASE_URL");
  console.log(process.env.NEXT_PUBLIC_OPENAI_API_KEY ? "API_KEY_SET" : "API_KEY_MISSING", "API_KEY_STATUS");
  
  if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
    throw new Error('NEXT_PUBLIC_OPENAI_API_KEY is not configured');
  }
  
  try {
    // 尝试使用 OpenAI SDK
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    console.log(`✅ 成功生成 ${text.substring(0, 50)}... 的向量嵌入`);
    return response.data[0].embedding;
    
  } catch (error) {
    console.error('OpenAI 嵌入 API 失败，尝试备用方案:', error);
    
    // 备用方案：使用手动 fetch 调用
    try {
      const baseURL = process.env.NEXT_PUBLIC_OPENAI_BASE_URL || "https://api.openai.com";
      const apiUrl = `${baseURL}/v1/embeddings`;
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("❌ 嵌入 API 错误:", response.status, errorData);
        throw new Error(`Embedding API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      console.log(`✅ 通过备用方案成功生成 ${text.substring(0, 50)}... 的向量嵌入`);
      return data.data[0].embedding;
      
    } catch (fetchError) {
      console.error('❌ 手动 fetch 也失败:', fetchError);
      throw new Error(`Failed to generate embedding: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
    }
  }
} 