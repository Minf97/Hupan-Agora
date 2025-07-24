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

// 存储agent状态
let agentStates = [
  { id: 1, name: '张三', x: 5, y: 5, color: '#FF5733', status: 'idle' },
  { id: 2, name: '李四', x: 15, y: 10, color: '#33A1FF', status: 'idle' },
  { id: 3, name: '王五', x: 8, y: 18, color: '#33FF57', status: 'idle' },
];

let townTime = { hour: 8, minute: 0 };

// 监听连接
io.on('connection', (socket) => {
  console.log('客户端已连接:', socket.id);
  console.log('客户端传输方式:', socket.conn.transport.name);

  // 发送初始状态
  console.log('发送初始数据到客户端:', socket.id);
  // TODO: 这里 agentStates 要从数据库拿
  socket.emit('init', { agents: agentStates, townTime });

  // 监听任务完成上报
  socket.on('task_complete', (data) => {
    console.log('收到任务完成上报:', data);

    // 更新agent状态
    const agentIndex = agentStates.findIndex(a => a.id === data.agentId);
    if (agentIndex !== -1) {
      agentStates[agentIndex] = {
        ...agentStates[agentIndex],
        status: data.status,
        x: data.position?.x || agentStates[agentIndex].x,
        y: data.position?.y || agentStates[agentIndex].y
      };
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

// 每秒更新时间 (1秒 = 1分钟城镇时间)
setInterval(() => {
  townTime = {
    hour: ((townTime.minute + 1) >= 60) ? (townTime.hour + 1) % 24 : townTime.hour,
    minute: (townTime.minute + 1) % 60
  };

  const clientsCount = io.engine.clientsCount;
  if (clientsCount > 0) {
    console.log(`发送时间更新到 ${clientsCount} 个客户端`);
    io.emit('timeUpdate', townTime);
  }
}, 1000);

// 定期为空闲的agent分配任务
setInterval(() => {
  const clientsCount = io.engine.clientsCount;
  if (clientsCount > 0) {
    // 找到所有空闲的agent
    const idleAgents = agentStates.filter(agent => agent.status === 'idle');

    // 为每个空闲agent分配任务（30%概率）
    idleAgents.forEach(agent => {
      if (Math.random() < 0.3) {
        // 获取所有连接的socket
        const sockets = Array.from(io.sockets.sockets.values());
        if (sockets.length > 0) {
          const randomSocket = sockets[Math.floor(Math.random() * sockets.length)];

          assignRandomTask(agent.id, randomSocket);
        }
      }
    });

    // TODO: 这里要上传到后端，同步数据库
  }
}, 3000);

// 定期打印统计信息
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