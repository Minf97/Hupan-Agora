// workers/src/index.ts - Hono WebSocket server connecting to Supabase
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDatabaseConnection, type Database } from './db/index';
import { getAllAgents, updateAgentState, type SocketAgent } from './db/services/agents';
import { addThought } from './db/services/thoughts';
import { agents } from './db/schema';
import { eq } from 'drizzle-orm';

type Bindings = {
  WEBSOCKET_SESSIONS: DurableObjectNamespace;
  DATABASE_URL: string;
  OPENAI_API_KEY?: string;
  FRONTEND_URL?: string;
}

const app = new Hono<{ Bindings: Bindings }>();

// CORS配置
app.use('*', cors({
  origin: (origin, c) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      'https://vercel.app',
      'https://*.vercel.app'
    ];
    
    if (!origin) return origin; // Allow requests with no origin (mobile apps, etc.)
    
    const isAllowed = allowedOrigins.some(allowed => 
      allowed.includes('*') ? 
        origin.includes(allowed.replace('*.', '')) : 
        origin === allowed
    );
    
    return isAllowed ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 健康检查
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    service: 'websocket-server-supabase',
    timestamp: new Date().toISOString()
  });
});

// WebSocket升级端点
app.get('/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }

  // 创建Durable Object ID
  const id = c.env.WEBSOCKET_SESSIONS.idFromName('main-session');
  const stub = c.env.WEBSOCKET_SESSIONS.get(id);
  
  return stub.fetch(c.req.raw);
});

// Agents API - 获取所有agents
app.get('/api/agents', async (c) => {
  try {
    const db = createDatabaseConnection(c.env.DATABASE_URL);
    const agents = await getAllAgents(db);
    return c.json(agents);
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return c.json({ error: 'Failed to fetch agents' }, 500);
  }
});

// Agent状态更新API
app.put('/api/agents/:id', async (c) => {
  const agentId = parseInt(c.req.param('id'));
  const { status, x, y, currentTask } = await c.req.json();
  
  try {
    const db = createDatabaseConnection(c.env.DATABASE_URL);
    await updateAgentState(db, agentId, { status, x, y, currentTask });
    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to update agent:', error);
    return c.json({ error: 'Failed to update agent' }, 500);
  }
});

export default app;

// Durable Object for WebSocket sessions
export class WebSocketSession implements DurableObject {
  private storage: DurableObjectStorage;
  private env: Bindings;
  private sessions: Set<WebSocket>;
  private agentStates: Map<number, SocketAgent>;
  private activeConversations: Map<string, any>;
  private townTime: { hour: number; minute: number };
  private db: Database;
  private timers: Set<any>;

  constructor(state: DurableObjectState, env: Bindings) {
    this.storage = state.storage;
    this.env = env;
    this.sessions = new Set();
    this.agentStates = new Map();
    this.activeConversations = new Map();
    this.townTime = { hour: 8, minute: 0 };
    this.timers = new Set();
    
    // 延迟数据库连接初始化，避免构造函数中的异步操作
    
    try {
      this.db = createDatabaseConnection(env.DATABASE_URL);
      
    } catch (error) {
      console.error('Failed to create database connection:', error);
      throw new Error('Database connection failed');
    }
    
    // 初始化定时器
    this.initializeTimers();
  }

  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    console.log(`🔌 新的WebSocket连接请求 - URL: ${request.url}`);
    console.log(`📊 当前会话数: ${this.sessions.size}`);
    console.log(`📊 当前对话数: ${this.activeConversations.size}`);

    // 确保异步处理 WebSocket 连接
    this.handleSession(server).catch(error => {
      console.error('WebSocket session handling error:', error);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleSession(webSocket: WebSocket) {
    webSocket.accept();
    this.sessions.add(webSocket);

    console.log('New WebSocket connection established');

    // 加载初始数据
    await this.loadAgentsFromDatabase();
    
    // 发送初始状态
    const agents = Array.from(this.agentStates.values());
    this.sendToSocket(webSocket, 'init', { agents, townTime: this.townTime });

    webSocket.addEventListener('message', (event) => {
      // 使用立即执行的异步函数来处理消息
      (async () => {
        try {
          const data = JSON.parse(event.data as string);
          await this.handleMessage(webSocket, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      })();
    });

    webSocket.addEventListener('close', () => {
      console.log('WebSocket connection closed');
      this.sessions.delete(webSocket);
    });

    webSocket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.sessions.delete(webSocket);
    });
  }

  private async handleMessage(webSocket: WebSocket, data: any) {
    const { type, payload } = data;

    switch (type) {
      case 'agentUpdate':
        await this.handleAgentUpdate(payload);
        break;
      case 'stopAgentMovement':
        await this.handleStopAgentMovement(payload);
        break;
      case 'task_complete':
        await this.handleTaskComplete(payload, webSocket);
        break;
      default:
        console.log('Unknown message type:', type);
    }
  }

  private async handleAgentUpdate(data: any) {
    const { agentId, status, position } = data;
    
    const agent = this.agentStates.get(agentId);
    if (!agent) return;

    const updates = {
      status: status || agent.status,
      x: position?.x || agent.x,
      y: position?.y || agent.y
    };

    // 更新内存状态
    this.agentStates.set(agentId, { ...agent, ...updates });

    // 更新数据库
    try {
      await updateAgentState(this.db, agentId, updates);
    } catch (error) {
      console.error('Failed to update agent in database:', error);
    }

    // 广播更新
    this.broadcast('agentStateUpdate', {
      agentId,
      status: updates.status,
      position: { x: updates.x, y: updates.y }
    });
  }

  private async handleStopAgentMovement(data: any) {
    const { agentId } = data;
    
    const agent = this.agentStates.get(agentId);
    if (!agent) return;

    const updates = {
      status: 'idle',
      currentTask: null
    };

    this.agentStates.set(agentId, { ...agent, ...updates });
    
    try {
      await updateAgentState(this.db, agentId, updates);
    } catch (error) {
      console.error('Failed to update agent in database:', error);
    }

    this.broadcast('agentStateUpdate', {
      agentId,
      status: 'idle',
      position: { x: agent.x, y: agent.y }
    });
  }

  private async handleTaskComplete(data: any, webSocket: WebSocket) {
    const { agentId, status, position } = data;
    
    const agent = this.agentStates.get(agentId);
    if (!agent) {
      console.error(`Agent ${agentId} not found in task complete`);
      return;
    }

    const updates = {
      status,
      x: position?.x || agent.x,
      y: position?.y || agent.y
    };

    console.log(`📍 Agent ${agent.name}(${agentId}) 任务完成: ${agent.status} -> ${updates.status} at (${updates.x}, ${updates.y})`);

    // 检查相遇
    const collidedAgent = this.checkAgentCollision(agentId, updates);
    
    if (collidedAgent) {
      await this.handleAgentCollision(agentId, collidedAgent, updates);
    } else {
      // 更新代理状态
      const updatedAgent = { ...agent, ...updates };
      this.agentStates.set(agentId, updatedAgent);
      
      // 广播状态更新
      this.broadcast('agentStateUpdate', {
        agentId,
        status: updates.status,
        position: { x: updates.x, y: updates.y }
      });
    }

    try {
      await updateAgentState(this.db, agentId, updates);
    } catch (error) {
      console.error('Failed to update agent in database:', error);
    }

    // 如果变为idle，分配新任务
    if (status === 'idle') {
      setTimeout(() => {
        // 同步调用，不需要异步处理
        this.assignRandomTask(agentId, webSocket);
      }, 1000);
    }
  }

  private checkAgentCollision(agentId: number, position: any) {
    for (const [id, agent] of this.agentStates.entries()) {
      if (id !== agentId && agent.status === 'idle') {
        const distance = Math.sqrt(
          Math.pow(position.x - agent.x, 2) + Math.pow(position.y - agent.y, 2)
        );
        if (distance < 30) {
          return agent;
        }
      }
    }
    return null;
  }

  private async handleAgentCollision(agentId: number, collidedAgent: any, updates: any) {
    // 设置两个agent为对话状态
    updates.status = 'talking';
    
    const agent = this.agentStates.get(agentId);
    if (!agent) {
      console.error(`Agent ${agentId} not found in collision handling`);
      return;
    }

    // 更新两个代理的状态
    const updatedAgent1 = { ...agent, ...updates };
    const updatedAgent2 = { ...collidedAgent, status: 'talking' };
    
    this.agentStates.set(agentId, updatedAgent1);
    this.agentStates.set(collidedAgent.id, updatedAgent2);

    console.log(`🤝 代理碰撞: ${agent.name}(${agentId}) 在 (${updates.x}, ${updates.y}) 遇到 ${collidedAgent.name}(${collidedAgent.id}) 在 (${collidedAgent.x}, ${collidedAgent.y})`);

    // 广播状态变化
    this.broadcast('agentStateUpdate', {
      agentId,
      status: 'talking',
      position: { x: updates.x, y: updates.y }
    });

    this.broadcast('agentStateUpdate', {
      agentId: collidedAgent.id,
      status: 'talking',
      position: { x: collidedAgent.x, y: collidedAgent.y }
    });

    // 创建对话
    const conversationId = `conv-${agentId}-${collidedAgent.id}-${Date.now()}`;
    const conversation = {
      id: conversationId,
      agent1Id: agentId,
      agent1Name: agent.name,
      agent2Id: collidedAgent.id,
      agent2Name: collidedAgent.name,
      startTime: Date.now(),
      messages: [],
      messageCount: 0
    };

    this.activeConversations.set(conversationId, conversation);

    this.broadcast('conversation_start', {
      conversationId,
      agent1Id: agentId,
      agent1Name: agent?.name,
      agent2Id: collidedAgent.id,
      agent2Name: collidedAgent.name
    });

    // 生成对话内容
    this.generateConversationMessages(conversationId, {
      agent1Id: agentId,
      agent1Name: agent?.name,
      agent2Id: collidedAgent.id,
      agent2Name: collidedAgent.name
    });

    // 设置对话结束定时器
    const timer = setTimeout(() => {
      // 使用立即执行的异步函数
      (async () => {
        await this.endConversation(conversationId);
      })().catch(error => {
        console.error('Error ending conversation:', error);
      });
    }, 15000);
    this.timers.add(timer);
  }

  private async loadAgentsFromDatabase() {
    try {
      console.log('开始从数据库加载代理数据...');
      
      const agents = await getAllAgents(this.db);
      console.log(`从数据库获取到 ${agents.length} 个代理:`, agents.map(a => `${a.name}(${a.id})`));
      
      
      for (const agent of agents) {
        // 重置异常状态
        if (agent.status === 'talking' || agent.status === 'busy') {
          agent.status = 'idle';
          agent.currentTask = null;
          await updateAgentState(this.db, agent.id, { status: 'idle', currentTask: null });
        }
        
        this.agentStates.set(agent.id, agent);
      }
      
      console.log(`✅ 成功加载 ${agents.length} 个代理，当前 agentStates 大小: ${this.agentStates.size}`);
    } catch (error) {
      console.error('❌ 从数据库加载代理失败:', (error as Error).message || error);
      console.log('📦 使用默认代理数据...');
      
      // 使用默认数据
      const defaultAgents = [
        { id: 1, name: 'Mike', x: 50, y: 50, color: '#FF5733', status: 'idle', currentTask: null },
        { id: 2, name: 'Cassin', x: 150, y: 100, color: '#33A1FF', status: 'idle', currentTask: null },
        { id: 3, name: 'Dax', x: 400, y: 180, color: '#33FF57', status: 'idle', currentTask: null },
        { id: 4, name: 'Roland', x: 600, y: 200, color: '#FF33A1', status: 'idle', currentTask: null },
        { id: 5, name: 'Sue', x: 300, y: 300, color: '#A133FF', status: 'idle', currentTask: null }
      ];
      
      for (const agent of defaultAgents) {
        this.agentStates.set(agent.id, agent as SocketAgent);
      }
      
      console.log(`✅ 使用默认代理数据，当前 agentStates 大小: ${this.agentStates.size}`);
      console.log('代理列表:', Array.from(this.agentStates.values()).map(a => `${a.name}(${a.id}) - ${a.status}`));
    }
  }

  private assignRandomTask(agentId: number, webSocket: WebSocket) {
    const agent = this.agentStates.get(agentId);
    if (!agent || agent.status !== 'idle') {
      console.log(`跳过代理 ${agentId}: 代理不存在或状态不是 idle (当前状态: ${agent?.status})`);
      return;
    }

    const targetPosition = this.generateValidPosition();
    const task = {
      agentId,
      task: {
        type: 'move',
        to: targetPosition
      }
    };
    console.log(this.sessions.size, "this.sessions.size");
    
    console.log(`🎯 为代理 ${agent.name}(${agentId}) 分配移动任务到 (${targetPosition.x}, ${targetPosition.y})`);
    this.sendToSocket(webSocket, 'agentTask', task);
  }

  private generateValidPosition() {
    const MAP_CONFIG = {
      width: 800,
      height: 800,
      obstacles: [
        { x: 100, y: 50, width: 200, height: 100 },
        { x: 400, y: 200, width: 150, height: 80 },
        { x: 200, y: 350, width: 180, height: 120 },
        { x: 550, y: 80, width: 120, height: 90 }
      ]
    };

    let x, y;
    let attempts = 0;
    const maxAttempts = 50;
    const margin = 20;

    do {
      x = Math.floor(Math.random() * (MAP_CONFIG.width - 2 * margin)) + margin;
      y = Math.floor(Math.random() * (MAP_CONFIG.height - 2 * margin)) + margin;
      attempts++;
    } while (this.isPointInObstacle(x, y, MAP_CONFIG) && attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return { x: MAP_CONFIG.width / 2, y: MAP_CONFIG.height / 2 };
    }

    return { x, y };
  }

  private isPointInObstacle(x: number, y: number, mapConfig: any) {
    return mapConfig.obstacles.some((obstacle: any) =>
      x >= obstacle.x && x <= obstacle.x + obstacle.width &&
      y >= obstacle.y && y <= obstacle.y + obstacle.height
    );
  }

  private async generateConversationMessages(conversationId: string, participants: any) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return;

    try {
      // 获取代理个性信息从数据库
      const agent1Personality = await this.getAgentPersonalityForServer(participants.agent1Id);
      const agent2Personality = await this.getAgentPersonalityForServer(participants.agent2Id);

      // 生成3-5轮对话
      const messageCount = 3 + Math.floor(Math.random() * 3);

      for (let i = 0; i < messageCount; i++) {
        const timer = setTimeout(() => {
          // 使用立即执行的异步函数来处理定时器中的异步操作
          (async () => {
            if (!this.activeConversations.has(conversationId)) return; // 对话可能已结束

            const speaker = i % 2 === 0 ? participants.agent1Name : participants.agent2Name;
            const speakerId = i % 2 === 0 ? participants.agent1Id : participants.agent2Id;
            const speakerPersonality = i % 2 === 0 ? agent1Personality : agent2Personality;

            try {
              // 生成消息内容
              const message = await this.generateMessageForAgent(speakerPersonality, i);

              // 添加到对话记录
              const messageData = {
                speaker,
                speakerId,
                content: message.content,
                emotion: message.emotion,
                timestamp: Date.now()
              };

              conversation.messages.push(messageData);
              conversation.messageCount++;

              // 广播新消息 - 直接发送完整的消息数据，不要嵌套在 message 字段中
              this.broadcast('conversation_message', {
                conversationId,
                speaker: messageData.speaker,
                content: messageData.content,
                timestamp: messageData.timestamp,
                emotion: messageData.emotion
              });

              // 保存对话到 thoughts 数据库
              try {
                await addThought(this.db, {
                  agentId: speakerId,
                  agentName: speaker,
                  type: 'conversation',
                  content: message.content,
                  metadata: {
                    emotion: message.emotion,
                    conversationId: conversationId
                  }
                });
                console.log(`💾 已保存 ${speaker} 的对话到 thoughts 表`);
              } catch (error) {
                console.error(`保存对话到 thoughts 表失败:`, error);
              }

              console.log(`🗣️  ${speaker}: ${message.content} [${message.emotion}]`);

            } catch (error) {
              console.error(`❌ 对话生成失败 (${speaker}):`, error);
              
              // AI生成失败时结束对话，不使用mock数据
              console.log(`🚫 由于AI生成失败，提前结束对话 ${conversationId}`);
              await this.endConversation(conversationId);
              return;
            }

          })();
        }, (i + 1) * (1000 + Math.random() * 2000)); // 1-3秒间隔
        
        this.timers.add(timer);
      }
    } catch (error) {
      console.error('生成对话消息失败:', error);
    }
  }

  // 获取代理个性信息（从数据库）
  private async getAgentPersonalityForServer(agentId: number) {
    try {
      const { getAgentById } = await import('./db/services/agents');
      const agent = await getAgentById(this.db, agentId);
      
      if (!agent) {
        // 返回默认个性
        return {
          name: `Agent${agentId}`,
          interests: ['聊天', '交流', '学习']
        };
      }

      // 从数据库获取完整的agent信息
      const result = await this.db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);
      
      const fullAgent = result[0];
      const interests = fullAgent?.tags && Array.isArray(fullAgent.tags) 
        ? fullAgent.tags 
        : ['编程', '技术', '交流'];

      return {
        name: agent.name,
        interests: interests,
        background: fullAgent?.bg || '友好的AI助手',
        color: agent.color,
        avatar: agent.avatar
      };
    } catch (error) {
      console.error('获取代理个性失败:', error);
      // 返回默认个性
      return {
        name: `Agent${agentId}`,
        interests: ['聊天', '交流', '学习']
      };
    }
  }

  // 为代理生成消息内容
  private async generateMessageForAgent(personality: any, messageIndex: number) {
    // 检查是否有OpenAI API Key
    if (!this.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API Key not configured - cannot generate conversations');
    }

    // 构建对话提示
    const systemPrompt = `你是${personality.name}，一个有着独特个性的数字人。
个性背景: ${personality.background || '友好的AI助手'}
兴趣爱好: ${personality.interests?.join('、') || '聊天、学习'}
当前情感: ${personality.mood || 'neutral'}

请生成一句自然的对话内容，符合你的个性特点。对话应该：
1. 简短自然，1-2句话
2. 体现你的个性特点
3. 适合与其他数字人的日常交谈
4. 中文回复

当前是第${messageIndex + 1}轮对话。`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '请生成一句对话内容' }
        ],
        max_tokens: 100,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error('No content generated from OpenAI');
    }

    // 简单的情感分析
    const emotions = ['开心', '好奇', '思考', '兴奋', '平静', '友好', '热情'];
    const emotion = emotions[Math.floor(Math.random() * emotions.length)];

    console.log(`🤖 ${personality.name} AI生成对话: "${content}" [${emotion}]`);

    return {
      content,
      emotion
    };
  }

  private async endConversation(conversationId: string) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return;

    console.log(`🔚 结束对话: ${conversationId} (${conversation.agent1Name} vs ${conversation.agent2Name})`);

    // 更新agent状态
    const agent1 = this.agentStates.get(conversation.agent1Id);
    const agent2 = this.agentStates.get(conversation.agent2Id);

    if (agent1) {
      agent1.status = 'idle';
      this.agentStates.set(conversation.agent1Id, agent1);
      
      // 广播agent1状态更新
      this.broadcast('agentStateUpdate', {
        agentId: conversation.agent1Id,
        status: 'idle',
        position: { x: agent1.x, y: agent1.y }
      });
      
      try {
        await updateAgentState(this.db, conversation.agent1Id, { status: 'idle' });
      } catch (error) {
        console.error('Failed to update agent status:', error);
      }
    }

    if (agent2) {
      agent2.status = 'idle';
      this.agentStates.set(conversation.agent2Id, agent2);
      
      // 广播agent2状态更新
      this.broadcast('agentStateUpdate', {
        agentId: conversation.agent2Id,
        status: 'idle',
        position: { x: agent2.x, y: agent2.y }
      });
      
      try {
        await updateAgentState(this.db, conversation.agent2Id, { status: 'idle' });
      } catch (error) {
        console.error('Failed to update agent status:', error);
      }
    }

    this.broadcast('conversation_end', {
      conversationId,
      agent1: conversation.agent1Id,
      agent2: conversation.agent2Id,
      duration: Date.now() - conversation.startTime,
      messages: conversation.messages
    });

    this.activeConversations.delete(conversationId);
  }

  private initializeTimers() {
    // 时间更新定时器
    const timeTimer = setInterval(() => {
      this.townTime = {
        hour: ((this.townTime.minute + 1) >= 60) ? (this.townTime.hour + 1) % 24 : this.townTime.hour,
        minute: (this.townTime.minute + 1) % 60
      };

      if (this.sessions.size > 0) {
        this.broadcast('timeUpdate', this.townTime);
      }
    }, 10000);
    this.timers.add(timeTimer);

    // 任务分配定时器
    const taskTimer = setInterval(() => {
      if (this.sessions.size > 0) {
        const allAgents = Array.from(this.agentStates.values());
        const idleAgents = allAgents.filter(agent => agent.status === 'idle');
        
        console.log(`任务分配检查: 总代理数 ${allAgents.length}, 空闲代理数 ${idleAgents.length}`);
        
        idleAgents.forEach(agent => {
          if (Math.random() < 0.5) {
            const sockets = Array.from(this.sessions);
            if (sockets.length > 0) {
              const randomSocket = sockets[Math.floor(Math.random() * sockets.length)];
              console.log(`为代理 ${agent.name} 分配随机任务`);
              this.assignRandomTask(agent.id, randomSocket);
            }
          }
        });
      } else {
        console.log('没有活跃的 WebSocket 连接，跳过任务分配');
      }
    }, 15000);
    this.timers.add(taskTimer);

    // 状态检查定时器
    const statusTimer = setInterval(() => {
      // 使用立即执行的异步函数
      (async () => {
        try {
          const now = Date.now();
          let fixedCount = 0;

          // 检查长时间处于talking状态的agents
          for (const [agentId, agent] of this.agentStates.entries()) {
            if (agent.status === 'talking') {
              // 检查是否有对应的活跃对话
              const hasActiveConversation = Array.from(this.activeConversations.values()).some(
                conv => conv.agent1Id === agentId || conv.agent2Id === agentId
              );

              if (!hasActiveConversation) {
                console.log(`Auto-fixing: Agent ${agent.name} is talking but has no active conversation`);

                agent.status = 'idle';
                agent.currentTask = null;
                this.agentStates.set(agentId, agent);

                try {
                  await updateAgentState(this.db, agentId, { status: 'idle', currentTask: null });
                  fixedCount++;
                } catch (error) {
                  console.error(`Failed to fix agent ${agent.name} status:`, error);
                }
              }
            }
          }

          // 检查过期的对话（超过30秒的对话应该被清理）
          const expiredConversations = [];
          for (const [conversationId, conversation] of this.activeConversations.entries()) {
            const conversationAge = now - conversation.startTime;
            if (conversationAge > 30000) { // 30秒
              expiredConversations.push(conversationId);
            }
          }

          // 清理过期对话
          for (const conversationId of expiredConversations) {
            await this.endConversation(conversationId);
          }

          if (fixedCount > 0) {
            console.log(`Status check completed, fixed ${fixedCount} abnormal states`);
          }

        } catch (error) {
          console.error('Error during status check:', error);
        }
      })();
    }, 15000);
    this.timers.add(statusTimer);
  }

  private broadcast(type: string, payload: any) {
    const message = JSON.stringify({ type, payload });
    this.sessions.forEach(ws => {
      try {
        ws.send(message);
      } catch (error) {
        console.error('Failed to send message to WebSocket:', error);
        this.sessions.delete(ws);
      }
    });
  }

  private sendToSocket(ws: WebSocket, type: string, payload: any) {
    try {
      ws.send(JSON.stringify({ type, payload }));
    } catch (error) {
      console.error('Failed to send message to specific WebSocket:', error);
    }
  }
}