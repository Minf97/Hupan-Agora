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

// 从数据库加载agents并重置状态
async function loadAgentsFromDatabase() {
  try {
    console.log('从数据库加载agents...');
    agentStates = await getAllAgents();
    console.log(`已加载 ${agentStates.length} 个agents:`, agentStates.map(a => a.name).join(', '));

    // 🔧 重置所有异常状态的agents
    await resetAbnormalAgentStates();

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

// 重置异常状态的agents
async function resetAbnormalAgentStates() {
  console.log('🔧 检查并重置异常状态的agents...');

  let resetCount = 0;
  const abnormalStates = ['talking', 'busy']; // 这些状态在服务器重启后应该被重置

  for (const agent of agentStates) {
    if (abnormalStates.includes(agent.status)) {
      console.log(`⚠️  重置Agent ${agent.name} 的状态: ${agent.status} → idle`);

      try {
        // 更新内存中的状态
        agent.status = 'idle';
        agent.currentTask = null;

        // 更新数据库中的状态
        await updateAgentState(agent.id, {
          status: 'idle',
          currentTask: null
        });

        resetCount++;
      } catch (error) {
        console.error(`❌ 重置Agent ${agent.name} 状态失败:`, error);
      }
    }
  }

  if (resetCount > 0) {
    console.log(`✅ 已重置 ${resetCount} 个agents的异常状态`);
  } else {
    console.log('✅ 所有agents状态正常，无需重置');
  }

  // 清空所有活跃对话（服务器重启后对话都应该结束）
  activeConversations.clear();
  console.log('🧹 已清空所有活跃对话记录');
}

// 启动时加载agents并重置状态
loadAgentsFromDatabase().then(() => {
  console.log('🚀 服务器初始化完成，所有agents状态已重置');
}).catch(error => {
  console.error('❌ 服务器初始化失败:', error);
});

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
          agent1Id: data.agentId,  // 修复字段名
          agent1Name: agentStates[agentIndex].name,
          agent2Id: collidedAgent.id,  // 修复字段名
          agent2Name: collidedAgent.name,
          startTime: Date.now(),
          messages: [],
          messageCount: 0  // 添加消息计数
        });

        // 广播对话开始事件
        io.emit('conversation_start', {
          conversationId,
          agent1Id: data.agentId,  // 修复字段名
          agent1Name: agentStates[agentIndex].name,
          agent2Id: collidedAgent.id,  // 修复字段名
          agent2Name: collidedAgent.name
        });

        // 异步生成对话内容
        generateConversationMessages(conversationId, {
          agent1Id: data.agentId,
          agent1Name: agentStates[agentIndex].name,
          agent2Id: collidedAgent.id,
          agent2Name: collidedAgent.name
        });

        // 设置对话结束计时器（10-20秒后结束，给AI生成时间）
        const conversationDuration = 10000 + Math.random() * 10000;
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

// 定义地图配置（与前端保持一致）
const MAP_CONFIG = {
  width: 800,
  height: 600,
  gridSize: 20,
  obstacles: [
    { x: 100, y: 50, width: 200, height: 100 },
    { x: 400, y: 200, width: 150, height: 80 },
    { x: 200, y: 350, width: 180, height: 120 },
    { x: 550, y: 80, width: 120, height: 90 },
  ]
};

io.engine.on('connection_error', (err) => {
  console.error('Socket.IO引擎连接错误:', err);
});

// 检查点是否在障碍物内
function isPointInObstacle(x, y) {
  return MAP_CONFIG.obstacles.some(obstacle =>
    x >= obstacle.x && x <= obstacle.x + obstacle.width &&
    y >= obstacle.y && y <= obstacle.y + obstacle.height
  );
}

// 生成有效的目标位置（不在障碍物内，在地图边界内）
function generateValidPosition() {
  // 边缘安全距离
  const margin = 20;

  let x, y;
  let attempts = 0;
  const maxAttempts = 50;

  do {
    // 生成在安全范围内的随机坐标
    x = Math.floor(Math.random() * (MAP_CONFIG.width - 2 * margin)) + margin;
    y = Math.floor(Math.random() * (MAP_CONFIG.height - 2 * margin)) + margin;
    attempts++;
  } while (isPointInObstacle(x, y) && attempts < maxAttempts);

  // 如果尝试多次仍找不到有效位置，则返回地图中心点
  if (attempts >= maxAttempts) {
    return { x: MAP_CONFIG.width / 2, y: MAP_CONFIG.height / 2 };
  }

  return { x, y };
}

// 分配随机任务
function assignRandomTask(agentId, socket) {
  const agent = agentStates.find(a => a.id === agentId);
  if (!agent || agent.status !== 'idle') return;

  // 目前只使用move任务类型
  const randomTaskType = 'move';

  let task;
  switch (randomTaskType) {
    case 'move':
      // 随机移动到一个位置
      const targetPosition = generateValidPosition();
      console.log(targetPosition, "targetPosition!!");

      task = {
        agentId: agentId,
        task: {
          type: 'move',
          to: targetPosition
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
      // 获取所有连接的socket
      const sockets = Array.from(io.sockets.sockets.values());
      if (sockets.length > 0) {
        const randomSocket = sockets[Math.floor(Math.random() * sockets.length)];

        assignRandomTask(agent.id, randomSocket);
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

// 定期状态检查和自动修复机制
setInterval(async () => {
  try {
    const now = Date.now();
    let fixedCount = 0;

    // 检查长时间处于talking状态的agents
    for (const agent of agentStates) {
      if (agent.status === 'talking') {
        // 检查是否有对应的活跃对话
        const hasActiveConversation = Array.from(activeConversations.values()).some(
          conv => conv.agent1Id === agent.id || conv.agent2Id === agent.id
        );

        if (!hasActiveConversation) {
          console.log(`🔧 自动修复: Agent ${agent.name} 处于talking状态但无活跃对话，重置为idle`);

          agent.status = 'idle';
          agent.currentTask = null;

          try {
            await updateAgentState(agent.id, {
              status: 'idle',
              currentTask: null
            });
            fixedCount++;
          } catch (error) {
            console.error(`❌ 修复Agent ${agent.name} 状态失败:`, error);
          }
        }
      }
    }

    // 检查过期的对话（超过30秒的对话应该被清理）
    const expiredConversations = [];
    for (const [conversationId, conversation] of activeConversations.entries()) {
      const conversationAge = now - conversation.startTime;
      if (conversationAge > 30000) { // 30秒
        expiredConversations.push(conversationId);
      }
    }

    // 清理过期对话
    expiredConversations.forEach(conversationId => {
      const conversation = activeConversations.get(conversationId);
      if (conversation) {
        console.log(`🗑️ 清理过期对话: ${conversation.agent1Name} ↔ ${conversation.agent2Name} (${Math.round((now - conversation.startTime) / 1000)}秒)`);
        endConversation(conversationId);
      }
    });

    if (fixedCount > 0) {
      console.log(`🛠️ 状态检查完成，修复了 ${fixedCount} 个异常状态`);
    }

  } catch (error) {
    console.error('❌ 状态检查过程中发生错误:', error);
  }
}, 15000); // 每15秒检查一次

// AI对话生成函数
async function generateConversationMessages(conversationId, participants) {
  const conversation = activeConversations.get(conversationId);
  if (!conversation) return;

  try {
    // 获取代理个性信息（这里使用简化版本，实际应该从数据库获取）
    const agent1Personality = getAgentPersonalityForServer(participants.agent1Id);
    const agent2Personality = getAgentPersonalityForServer(participants.agent2Id);

    // 生成3-5轮对话
    const messageCount = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < messageCount; i++) {
      // 延迟发送，模拟真实对话节奏
      setTimeout(async () => {
        if (!activeConversations.has(conversationId)) return; // 对话可能已结束

        const speaker = i % 2 === 0 ? participants.agent1Name : participants.agent2Name;
        const speakerId = i % 2 === 0 ? participants.agent1Id : participants.agent2Id;
        const speakerPersonality = i % 2 === 0 ? agent1Personality : agent2Personality;

        // 生成消息内容
        const message = await generateMessageForAgent(speakerPersonality, i);

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

        // 广播新消息
        io.emit('conversation_message', {
          conversationId,
          message: messageData
        });

        console.log(`🗣️  ${speaker}: ${message.content} [${message.emotion}]`);

      }, (i + 1) * (1000 + Math.random() * 2000)); // 1-3秒间隔
    }
  } catch (error) {
    console.error('生成对话消息失败:', error);
  }
}

// 为代理生成消息内容
async function generateMessageForAgent(personality, messageIndex) {
  // 根据消息索引和个性生成不同类型的消息
  const messageTypes = {
    0: 'greeting', // 问候
    1: 'topic_introduction', // 话题介绍
    2: 'discussion', // 讨论
    3: 'agreement_disagreement', // 同意/不同意
    4: 'farewell' // 告别
  };

  const messageType = messageTypes[Math.min(messageIndex, 4)];

  // 根据个性和消息类型生成内容
  const messages = {
    greeting: [
      `你好！今天天气不错呢。`,
      `嗨，很高兴遇到你！`,
      `早上好，最近怎么样？`,
      `哇，没想到在这里碰到你！`
    ],
    topic_introduction: [
      `我刚刚在想${personality.interests[0]}的事情。`,
      `你对${personality.interests[Math.floor(Math.random() * personality.interests.length)]}有兴趣吗？`,
      `最近我在学习一些新东西，特别有意思。`,
      `你有什么新的发现或想法吗？`
    ],
    discussion: [
      `我觉得这个话题很有趣呢！`,
      `从我的经验来看，这确实值得深入思考。`,
      `你说得很有道理，我之前没这么想过。`,
      `这让我想起了之前的一个经历...`
    ],
    agreement_disagreement: [
      `完全同意你的观点！`,
      `我有一些不同的看法，不过很有意思。`,
      `是的，我也是这么认为的。`,
      `嗯，这确实是个值得讨论的话题。`
    ],
    farewell: [
      `聊得很开心，希望下次还能遇到你！`,
      `时间过得真快，我该去忙其他事情了。`,
      `谢谢你的分享，让我学到了很多。`,
      `再见，保重！`
    ]
  };

  const emotions = ['happy', 'excited', 'neutral', 'thoughtful', 'friendly'];
  const selectedMessages = messages[messageType] || messages.discussion;

  return {
    content: selectedMessages[Math.floor(Math.random() * selectedMessages.length)],
    emotion: emotions[Math.floor(Math.random() * emotions.length)]
  };
}

// 简化的代理个性获取函数（服务器端版本）
function getAgentPersonalityForServer(agentId) {
  // 简化的个性数据，实际应该从数据库获取
  const personalities = {
    1: { name: '张三', interests: ['编程', '技术', '游戏'] },
    2: { name: '李四', interests: ['旅行', '美食', '运动'] },
    3: { name: '王五', interests: ['设计', '艺术', '音乐'] }
  };

  return personalities[agentId] || {
    name: `Agent${agentId}`,
    interests: ['聊天', '交友', '学习']
  };
}

// 优雅关闭处理函数
async function gracefulShutdown(signal) {
  console.log(`\n📡 收到 ${signal} 信号，开始优雅关闭服务器...`);

  try {
    // 1. 停止接受新连接
    server.close(() => {
      console.log('🔒 HTTP服务器已停止接受新连接');
    });

    // 2. 重置所有正在对话中的agents状态
    console.log('🔄 重置所有agents状态...');
    let resetCount = 0;

    for (const agent of agentStates) {
      if (agent.status === 'talking' || agent.status === 'busy') {
        try {
          agent.status = 'idle';
          agent.currentTask = null;

          await updateAgentState(agent.id, {
            status: 'idle',
            currentTask: null
          });

          resetCount++;
          console.log(`✅ 重置Agent ${agent.name} 状态: talking/busy → idle`);
        } catch (error) {
          console.error(`❌ 重置Agent ${agent.name} 状态失败:`, error);
        }
      }
    }

    if (resetCount > 0) {
      console.log(`✅ 已重置 ${resetCount} 个agents的状态`);
    }

    // 3. 清空活跃对话
    activeConversations.clear();
    console.log('🧹 已清空所有活跃对话记录');

    // 4. 断开所有socket连接
    const sockets = Array.from(io.sockets.sockets.values());
    console.log(`🔌 断开 ${sockets.length} 个socket连接...`);

    sockets.forEach(socket => {
      socket.emit('server_shutdown', { message: '服务器正在关闭' });
      socket.disconnect(true);
    });

    // 5. 关闭Socket.IO服务器
    io.close(() => {
      console.log('🔌 Socket.IO服务器已关闭');
    });

    console.log('✅ 优雅关闭完成');
    process.exit(0);

  } catch (error) {
    console.error('❌ 优雅关闭过程中发生错误:', error);
    process.exit(1);
  }
}

// 注册信号处理器
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon重启信号

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  console.error('Promise:', promise);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// 启动服务器
server.listen(WS_PORT, () => {
  console.log(`> WebSocket服务器准备就绪，监听在 http://localhost:${WS_PORT}`);
  console.log(`> 前端应用应连接到: ws://localhost:${WS_PORT}`);
  console.log(`🛡️  优雅关闭处理器已注册 (SIGTERM, SIGINT, SIGUSR2)`);
}); 