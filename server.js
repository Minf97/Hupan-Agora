// 注册ts-node以支持TypeScript
require('ts-node/register');

const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 详细日志
console.log('初始化WebSocket服务器...');

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  // 简单响应以确认服务器运行状态
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'websocket-server' }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// WebSocket端口
const WS_PORT = process.env.WS_PORT || 4000;

console.log('初始化Socket.IO服务器...');

// 初始化Socket.IO服务器
const io = new SocketIOServer(server, {
  cors: {
    // 允许前端应用访问
    origin: process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["*"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  connectTimeout: 30000,
  pingTimeout: 30000,
  pingInterval: 10000
});

console.log('Socket.IO服务器已初始化，等待连接...');

// 导入数据库服务
const { getAllAgents, updateAgentState } = require('./db/services/agents-cjs');

// 存储agent状态（从数据库加载）
let agentStates = [];

let townTime = { hour: 8, minute: 0 };

// 从数据库加载agents
async function loadAgentsFromDatabase() {
  try {
    console.log('从数据库加载agents...');
    agentStates = await getAllAgents();
    console.log(`已加载 ${agentStates.length} 个agents:`, agentStates.map(a => a.name).join(', '));
  } catch (error) {
    console.error('加载agents失败:', error);
    // 如果数据库加载失败，使用默认数据
    agentStates = [
      { id: 1, name: '张三', x: 5, y: 5, color: '#FF5733', status: 'idle' },
      { id: 2, name: '李四', x: 15, y: 10, color: '#33A1FF', status: 'idle' },
      { id: 3, name: '王五', x: 8, y: 18, color: '#33FF57', status: 'idle' },
    ];
    console.log('使用默认agents数据');
  }
}

// 启动时加载agents
loadAgentsFromDatabase();

// 计算两点之间的距离
function calculateDistance(pos1, pos2) {
  return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
}

// 检查是否有相遇发生
function checkAgentCollision(agentId, position) {
  const otherAgents = agentStates.filter(a => a.id !== agentId && a.status === 'idle');
  
  for (const otherAgent of otherAgents) {
    const distance = calculateDistance(
      position,
      { x: otherAgent.x, y: otherAgent.y }
    );
    
    // 如果距离小于30像素，认为相遇了
    if (distance < 30) {
      return otherAgent;
    }
  }
  
  return null;
}

// 跟踪活跃的对话
const activeConversations = new Map();

// 监听连接
io.on('connection', async (socket) => {
  console.log('客户端已连接:', socket.id);
  console.log('客户端传输方式:', socket.conn.transport.name);

  // 确保agents已加载，如果没有则重新加载
  if (agentStates.length === 0) {
    await loadAgentsFromDatabase();
  }

  // 发送初始状态
  console.log('发送初始数据到客户端:', socket.id);
  socket.emit('init', { agents: agentStates, townTime });

  // 监听任务完成上报
  socket.on('task_complete', async (data) => {
    console.log('收到任务完成上报:', data);

    // 更新内存中的agent状态
    const agentIndex = agentStates.findIndex(a => a.id === data.agentId);
    if (agentIndex !== -1) {
      const updates = {
        status: data.status,
        x: data.position?.x || agentStates[agentIndex].x,
        y: data.position?.y || agentStates[agentIndex].y
      };

      // 检查是否与其他agent相遇
      const collidedAgent = checkAgentCollision(data.agentId, updates);
      
      if (collidedAgent) {
        console.log(`检测到Agent ${data.agentId} 与 Agent ${collidedAgent.id} 相遇`);
        
        // 设置两个agent为对话状态
        updates.status = 'talking';
        
        // 更新当前agent状态
        agentStates[agentIndex] = {
          ...agentStates[agentIndex],
          ...updates
        };
        
        // 更新被相遇的agent状态
        const otherAgentIndex = agentStates.findIndex(a => a.id === collidedAgent.id);
        if (otherAgentIndex !== -1) {
          agentStates[otherAgentIndex] = {
            ...agentStates[otherAgentIndex],
            status: 'talking'
          };
          
          // 同步更新到数据库
          try {
            await updateAgentState(collidedAgent.id, {
              status: 'talking'
            });
          } catch (error) {
            console.error(`同步Agent ${collidedAgent.id} 状态到数据库失败:`, error);
          }
        }
        
        // 记录活跃对话
        const conversationId = `conv-${data.agentId}-${collidedAgent.id}-${Date.now()}`;
        activeConversations.set(conversationId, {
          id: conversationId,
          agent1: data.agentId,
          agent1Name: agentStates[agentIndex].name,
          agent2: collidedAgent.id,
          agent2Name: collidedAgent.name,
          startTime: Date.now(),
          messages: []
        });
        
        // 广播对话开始事件
        io.emit('conversation_start', {
          conversationId,
          agent1: data.agentId,
          agent1Name: agentStates[agentIndex].name,
          agent2: collidedAgent.id,
          agent2Name: collidedAgent.name
        });
        
        // 设置对话结束计时器（5-15秒后结束）
        const conversationDuration = 5000 + Math.random() * 10000;
        setTimeout(() => {
          // 结束对话
          endConversation(conversationId);
        }, conversationDuration);
      } else {
        agentStates[agentIndex] = {
          ...agentStates[agentIndex],
          ...updates
        };
      }

      // 同步更新到数据库
      try {
        await updateAgentState(data.agentId, {
          x: updates.x,
          y: updates.y,
          status: updates.status
        });
        console.log(`Agent ${data.agentId} 状态已同步到数据库`);
      } catch (error) {
        console.error(`同步Agent ${data.agentId} 状态到数据库失败:`, error);
      }
    }

    // 如果agent变为空闲状态，可以分配新任务
    if (data.status === 'idle') {
      // 延迟一下再分配新任务，避免立即分配
      setTimeout(() => {
        assignRandomTask(data.agentId, socket);
      }, 1000);
    }
  });

  // 监听客户端断开连接
  socket.on('disconnect', (reason) => {
    console.log('客户端断开连接:', socket.id, '原因:', reason);
  });

  // 监听错误
  socket.on('error', (error) => {
    console.error('socket错误:', error);
  });

  // 添加ping/pong监控
  socket.on('ping', () => {
    console.log('收到ping:', socket.id);
  });

  socket.on('pong', (latency) => {
    console.log('收到pong:', socket.id, '延迟:', latency, 'ms');
  });
});

// 结束对话函数
function endConversation(conversationId) {
  const conversation = activeConversations.get(conversationId);
  if (!conversation) return;
  
  console.log(`对话 ${conversationId} 结束`);
  
  // 更新agent状态
  const agent1Index = agentStates.findIndex(a => a.id === conversation.agent1);
  const agent2Index = agentStates.findIndex(a => a.id === conversation.agent2);
  
  if (agent1Index !== -1) {
    agentStates[agent1Index].status = 'idle';
    updateAgentState(conversation.agent1, { status: 'idle' })
      .catch(err => console.error(`更新Agent ${conversation.agent1} 状态失败:`, err));
  }
  
  if (agent2Index !== -1) {
    agentStates[agent2Index].status = 'idle';
    updateAgentState(conversation.agent2, { status: 'idle' })
      .catch(err => console.error(`更新Agent ${conversation.agent2} 状态失败:`, err));
  }
  
  // 广播对话结束事件
  io.emit('conversation_end', {
    conversationId,
    agent1: conversation.agent1,
    agent2: conversation.agent2,
    duration: Date.now() - conversation.startTime,
    messages: conversation.messages
  });
  
  // 从活跃对话中移除
  activeConversations.delete(conversationId);
}

io.engine.on('connection_error', (err) => {
  console.error('Socket.IO引擎连接错误:', err);
});

// 分配随机任务
function assignRandomTask(agentId, socket) {
  const agent = agentStates.find(a => a.id === agentId);
  if (!agent || agent.status !== 'idle') return;

  const taskTypes = ['move', 'talk', 'seek'];
  // const randomTaskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
  const randomTaskType = 'move';


  let task;
  switch (randomTaskType) {
    case 'move':
      // 随机移动到一个位置
      const targetX = Math.floor(Math.random() * 800);
      const targetY = Math.floor(Math.random() * 600);
      task = {
        agentId: agentId,
        task: {
          type: 'move',
          to: { x: targetX, y: targetY }
        }
      };
      break;
    case 'talk':
      // 寻找另一个agent进行对话
      const otherAgents = agentStates.filter(a => a.id !== agentId && a.status === 'idle');
      if (otherAgents.length > 0) {
        const targetAgent = otherAgents[Math.floor(Math.random() * otherAgents.length)];
        task = {
          agentId: agentId,
          task: {
            type: 'talk',
            targetAgentId: targetAgent.id,
            duration: 3000 + Math.random() * 4000 // 3-7秒对话
          }
        };
      } else {
        // 如果没有其他空闲agent，改为移动任务
        const targetX = Math.floor(Math.random() * 800);
        const targetY = Math.floor(Math.random() * 600);
        task = {
          agentId: agentId,
          task: {
            type: 'move',
            to: { x: targetX, y: targetY }
          }
        };
      }
      break;
    case 'seek':
      task = {
        agentId: agentId,
        task: {
          type: 'seek'
        }
      };
      break;
  }

  if (task) {
    console.log(`为Agent ${agentId} 分配任务:`, task);
    socket.emit('agentTask', task);
  }
}

// 每10秒更新时间 (优化: 减少频率从1秒到10秒)
setInterval(() => {
  townTime = {
    hour: ((townTime.minute + 1) >= 60) ? (townTime.hour + 1) % 24 : townTime.hour,
    minute: (townTime.minute + 1) % 60
  };

  const clientsCount = io.engine.clientsCount;
  if (clientsCount > 0) {
    io.emit('timeUpdate', townTime);
  }
}, 10000);

// 定期为空闲的agent分配任务 (优化: 降低频率和概率)
setInterval(() => {
  const clientsCount = io.engine.clientsCount;
  if (clientsCount > 0) {
    // 找到所有空闲的agent
    const idleAgents = agentStates.filter(agent => agent.status === 'idle');

    // 为每个空闲agent分配任务（降低概率从30%到10%）
    idleAgents.forEach(agent => {
      if (Math.random() < 0.1) {
        // 获取所有连接的socket
        const sockets = Array.from(io.sockets.sockets.values());
        if (sockets.length > 0) {
          const randomSocket = sockets[Math.floor(Math.random() * sockets.length)];

          assignRandomTask(agent.id, randomSocket);
        }
      }
    });
  }
}, 15000);

// 定期打印统计信息 (优化: 降低频率)
setInterval(() => {
  const clientsCount = io.engine.clientsCount;
  console.log(`当前连接客户端数: ${clientsCount}`);
  console.log('Agent状态:', agentStates.map(a => `${a.name}: ${a.status}`).join(', '));
  if (clientsCount > 0) {
    const sockets = Array.from(io.sockets.sockets.values());
    console.log('活跃socket:', sockets.map(s => s.id).join(', '));
  }
}, 5000);

// 启动服务器
server.listen(WS_PORT, () => {
  console.log(`> WebSocket服务器准备就绪，监听在 http://localhost:${WS_PORT}`);
  console.log(`> 前端应用应连接到: ws://localhost:${WS_PORT}`);
}); 