// workers/src/index.ts - Hono WebSocket server connecting to Supabase
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDatabaseConnection, type Database } from './db/index';
import { getAllAgents, updateAgentState, type SocketAgent } from './db/services/agents';
import { addThought } from './db/services/thoughts';

type Bindings = {
  WEBSOCKET_SESSIONS: DurableObjectNamespace;
  DATABASE_URL: string;
  OPENAI_API_KEY?: string;
  FRONTEND_URL?: string;
}

const app = new Hono<{ Bindings: Bindings }>();

// CORS配置
app.use('*', cors({
  origin: (origin) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      'https://vercel.app',
      'https://*.vercel.app'
    ];
    
    if (!origin) return true; // Allow requests with no origin (mobile apps, etc.)
    
    return allowedOrigins.some(allowed => 
      allowed.includes('*') ? 
        origin.includes(allowed.replace('*.', '')) : 
        origin === allowed
    );
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
    this.db = createDatabaseConnection(env.DATABASE_URL);
    this.timers = new Set();
    
    // 初始化定时器
    this.initializeTimers();
  }

  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    await this.handleSession(server);

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

    webSocket.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        await this.handleMessage(webSocket, data);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
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
    if (!agent) return;

    const updates = {
      status,
      x: position?.x || agent.x,
      y: position?.y || agent.y
    };

    // 检查相遇
    const collidedAgent = this.checkAgentCollision(agentId, updates);
    
    if (collidedAgent) {
      await this.handleAgentCollision(agentId, collidedAgent, updates);
    } else {
      this.agentStates.set(agentId, { ...agent, ...updates });
    }

    try {
      await updateAgentState(this.db, agentId, updates);
    } catch (error) {
      console.error('Failed to update agent in database:', error);
    }

    // 如果变为idle，分配新任务
    if (status === 'idle') {
      setTimeout(() => {
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
    this.agentStates.set(agentId, { ...agent, ...updates });
    this.agentStates.set(collidedAgent.id, { ...collidedAgent, status: 'talking' });

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
      agent1Name: agent?.name,
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
    const timer = setTimeout(() => this.endConversation(conversationId), 15000);
    this.timers.add(timer);
  }

  private async loadAgentsFromDatabase() {
    try {
      const agents = await getAllAgents(this.db);
      
      for (const agent of agents) {
        // 重置异常状态
        if (agent.status === 'talking' || agent.status === 'busy') {
          agent.status = 'idle';
          agent.currentTask = null;
          await updateAgentState(this.db, agent.id, { status: 'idle', currentTask: null });
        }
        
        this.agentStates.set(agent.id, agent);
      }
      
      console.log(`Loaded ${agents.length} agents from Supabase`);
    } catch (error) {
      console.error('Failed to load agents from database:', error);
      // 使用默认数据
      const defaultAgents = [
        { id: 1, name: 'Mike', x: 5, y: 5, color: '#FF5733', status: 'idle' },
        { id: 2, name: 'Cassin', x: 15, y: 10, color: '#33A1FF', status: 'idle' },
        { id: 3, name: 'Dax', x: 40, y: 18, color: '#33FF57', status: 'idle' },
        { id: 4, name: 'Roland', x: 89, y: 18, color: '#FF33A1', status: 'idle' },
        { id: 5, name: 'Sue', x: 58, y: 18, color: '#A133FF', status: 'idle' }
      ];
      
      for (const agent of defaultAgents) {
        this.agentStates.set(agent.id, agent as SocketAgent);
      }
    }
  }

  private assignRandomTask(agentId: number, webSocket: WebSocket) {
    const agent = this.agentStates.get(agentId);
    if (!agent || agent.status !== 'idle') return;

    const targetPosition = this.generateValidPosition();
    const task = {
      agentId,
      task: {
        type: 'move',
        to: targetPosition
      }
    };

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

    const messageCount = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < messageCount; i++) {
      const timer = setTimeout(async () => {
        if (!this.activeConversations.has(conversationId)) return;

        const speaker = i % 2 === 0 ? participants.agent1Name : participants.agent2Name;
        const speakerId = i % 2 === 0 ? participants.agent1Id : participants.agent2Id;

        const message = this.generateMessageContent(i);
        const messageData = {
          speaker,
          speakerId,
          content: message.content,
          emotion: message.emotion,
          timestamp: Date.now()
        };

        conversation.messages.push(messageData);
        conversation.messageCount++;

        this.broadcast('conversation_message', {
          conversationId,
          message: messageData
        });

        // 保存到数据库
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
        } catch (error) {
          console.error('Failed to save thought:', error);
        }

      }, (i + 1) * (1000 + Math.random() * 2000));
      
      this.timers.add(timer);
    }
  }

  private generateMessageContent(messageIndex: number) {
    const messages = [
      ['你好！今天天气不错呢。', '嗨，很高兴遇到你！'],
      ['我刚刚在想一些有趣的事情。', '你对什么感兴趣呢？'],
      ['我觉得这个话题很有趣呢！', '从我的经验来看确实如此。'],
      ['完全同意你的观点！', '是的，我也是这么认为的。'],
      ['聊得很开心，希望下次还能遇到你！', '时间过得真快，再见！']
    ];

    const emotions = ['happy', 'excited', 'neutral', 'thoughtful', 'friendly'];
    const messageGroup = messages[Math.min(messageIndex, messages.length - 1)];
    
    return {
      content: messageGroup[Math.floor(Math.random() * messageGroup.length)],
      emotion: emotions[Math.floor(Math.random() * emotions.length)]
    };
  }

  private async endConversation(conversationId: string) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return;

    console.log(`Ending conversation: ${conversationId}`);

    // 更新agent状态
    const agent1 = this.agentStates.get(conversation.agent1Id);
    const agent2 = this.agentStates.get(conversation.agent2Id);

    if (agent1) {
      agent1.status = 'idle';
      this.agentStates.set(conversation.agent1Id, agent1);
      try {
        await updateAgentState(this.db, conversation.agent1Id, { status: 'idle' });
      } catch (error) {
        console.error('Failed to update agent status:', error);
      }
    }

    if (agent2) {
      agent2.status = 'idle';
      this.agentStates.set(conversation.agent2Id, agent2);
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
        const idleAgents = Array.from(this.agentStates.values()).filter(agent => agent.status === 'idle');
        
        idleAgents.forEach(agent => {
          if (Math.random() < 0.5) {
            const sockets = Array.from(this.sessions);
            if (sockets.length > 0) {
              const randomSocket = sockets[Math.floor(Math.random() * sockets.length)];
              this.assignRandomTask(agent.id, randomSocket);
            }
          }
        });
      }
    }, 15000);
    this.timers.add(taskTimer);

    // 状态检查定时器
    const statusTimer = setInterval(async () => {
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
        expiredConversations.forEach(conversationId => {
          this.endConversation(conversationId);
        });

        if (fixedCount > 0) {
          console.log(`Status check completed, fixed ${fixedCount} abnormal states`);
        }

      } catch (error) {
        console.error('Error during status check:', error);
      }
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