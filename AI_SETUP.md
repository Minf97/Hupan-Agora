# AI对话系统配置指南

## 概述

现在相遇系统已经集成了AI驱动的内心思考和对话功能。当两个Agent相遇时，系统会：

1. **内心思考阶段**: 每个Agent会根据自己的个性和对方的背景进行AI驱动的内心思考
2. **决策阶段**: 基于思考结果决定是否要开始对话
3. **对话阶段**: 如果双方都有意愿，则开始AI生成的自然对话

## 配置AI服务

### 1. 环境变量配置

创建 `.env.local` 文件并添加以下配置：

```bash
# OpenAI 配置 (推荐)
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_OPENAI_MODEL=gpt-3.5-turbo

# WebSocket服务器配置
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

### 2. 支持的AI服务提供商

- **OpenAI**: 需要API密钥，支持gpt-3.5-turbo和gpt-4
- **Claude**: 需要Anthropic API密钥（未来支持）
- **本地模型**: 支持本地部署的兼容OpenAI API的模型

### 3. 降级处理

如果AI服务不可用，系统会自动降级到基于规则的简单逻辑。

## 系统架构

### 核心组件

1. **AgentPersonality** (`lib/agent-personality.ts`): Agent个性和背景系统
2. **AIService** (`lib/ai-service.ts`): AI服务接口，支持多种提供商
3. **ConversationManager** (`lib/conversation-manager.ts`): 对话状态管理
4. **agent-utils** (`lib/agent-utils.ts`): 相遇处理和决策逻辑

### 数据流

```
Agent相遇 → 内心思考(AI) → 决策 → 开始对话(AI) → 对话管理 → 记忆存储
```

## 个性系统

每个Agent都有详细的个性设置：

- **基础信息**: 姓名、年龄、职业、背景
- **五大人格特征**: 外向性、宜人性、尽责性、神经质、开放性
- **兴趣爱好**: 影响对话话题
- **情绪状态**: 影响对话意愿
- **对话风格**: 正式程度、话多程度、友好程度

## 使用示例

```typescript
// 初始化AI服务
import { initializeAIService } from '@/lib/ai-config';
initializeAIService();

// 处理Agent相遇
import { processAgentEncounter } from '@/lib/agent-utils';
const result = await processAgentEncounter(agentId1, agentId2, {
  location: '街道',
  timeOfDay: 14,
  townTime: { hour: 14, minute: 30 }
});

// 开始对话
import { getConversationManager } from '@/lib/conversation-manager';
const manager = getConversationManager();
const conversation = await manager.startConversation({
  participants: [agentId1, agentId2],
  location: '街道',
  initiator: agentId1
});
```

## 扩展性

系统设计为高度可扩展：

- 可以轻松添加新的AI服务提供商
- 个性特征可以根据需要扩展
- 对话策略可以自定义
- 支持群体对话（多人对话）

## 调试

系统包含详细的控制台日志：

- Agent内心思考过程
- 对话决策逻辑
- 对话内容生成
- 错误处理和降级

查看浏览器控制台以了解系统运行状态。