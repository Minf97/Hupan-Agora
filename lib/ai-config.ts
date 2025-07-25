// lib/ai-config.ts - AI服务配置和初始化

import { getAIService, AIServiceConfig } from './ai-service';

// 默认AI服务配置
const DEFAULT_AI_CONFIG: AIServiceConfig = {
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
  model: process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-3.5-turbo',
  baseURL: process.env.NEXT_PUBLIC_OPENAI_BASE_URL,
  provider: 'openai'
};

// 初始化AI服务
export function initializeAIService(config?: Partial<AIServiceConfig>): void {
  const finalConfig = {
    ...DEFAULT_AI_CONFIG,
    ...config
  };

  if (!finalConfig.apiKey) {
    console.warn('AI service API key not found. Using fallback responses.');
    // 可以设置一个fallback provider或者使用mock服务
  }

  try {
    getAIService(finalConfig);
    console.log('AI service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize AI service:', error);
  }
}

// 检查AI服务是否可用
export function isAIServiceAvailable(): boolean {
  try {
    getAIService();
    return true;
  } catch {
    return false;
  }
}

// 环境变量配置指南
export const AI_CONFIG_GUIDE = {
  openai: {
    requiredEnvVars: ['NEXT_PUBLIC_OPENAI_API_KEY'],
    optionalEnvVars: ['NEXT_PUBLIC_OPENAI_MODEL', 'NEXT_PUBLIC_OPENAI_BASE_URL'],
    setup: 'Set NEXT_PUBLIC_OPENAI_API_KEY in your .env.local file'
  },
  claude: {
    requiredEnvVars: ['NEXT_PUBLIC_CLAUDE_API_KEY'],
    optionalEnvVars: ['NEXT_PUBLIC_CLAUDE_MODEL'],
    setup: 'Set NEXT_PUBLIC_CLAUDE_API_KEY in your .env.local file'
  },
  local: {
    requiredEnvVars: ['NEXT_PUBLIC_LOCAL_MODEL_URL'],
    optionalEnvVars: [],
    setup: 'Set NEXT_PUBLIC_LOCAL_MODEL_URL to your local model endpoint'
  }
};