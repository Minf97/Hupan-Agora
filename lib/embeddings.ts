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
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  console.log(process.env.NEXT_PUBLIC_OPENAI_BASE_URL, "process.env.NEXT_PUBLIC_OPENAI_BASE_URL");
  console.log(process.env.NEXT_PUBLIC_OPENAI_API_KEY, "process.env.NEXT_PUBLIC_OPENAI_API_KEY");
  try {
    // 尝试使用 OpenAI SDK
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('OpenAI 嵌入 API 失败，尝试备用方案:', error);
    
    // 备用方案：使用手动 fetch 调用，类似 ai-service.ts 的实现
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

      console.log(response, "response!!");
      

      if (!response.ok) {
        const errorData = await response.text();
        console.error("嵌入 API 错误:", response.status, errorData);
        
        // 如果嵌入 API 不可用，返回模拟向量
        console.warn('嵌入 API 不可用，使用模拟向量');
        return generateMockEmbedding(text);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (fetchError) {
      console.error('手动 fetch 也失败:', fetchError);
      // 最终备用方案：生成模拟嵌入向量
      return generateMockEmbedding(text);
    }
  }
}

// 生成模拟嵌入向量的备用函数
function generateMockEmbedding(text: string): number[] {
  // 基于文本内容生成确定性的 1536 维向量（text-embedding-3-small 的维度）
  const dimension = 1536;
  const embedding = new Array(dimension);
  
  // 使用简单的哈希函数生成确定性向量
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // 生成向量
  for (let i = 0; i < dimension; i++) {
    // 使用伪随机数生成器创建确定性向量
    hash = (hash * 9301 + 49297) % 233280;
    embedding[i] = (hash / 233280 - 0.5) * 2; // 归一化到 [-1, 1]
  }
  
  // 归一化向量
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / norm);
} 