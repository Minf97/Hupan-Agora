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

// 监听连接
io.on('connection', (socket) => {
  console.log('客户端已连接:', socket.id);
  console.log('客户端传输方式:', socket.conn.transport.name);

  // 发送初始状态
  const agents = [
    { id: 1, name: '张三', x: 5, y: 5, color: '#FF5733', moving: false },
    { id: 2, name: '李四', x: 15, y: 10, color: '#33A1FF', moving: false },
    { id: 3, name: '王五', x: 8, y: 18, color: '#33FF57', moving: false },
  ];

  const townTime = { hour: 8, minute: 0 };

  console.log('发送初始数据到客户端:', socket.id);
  socket.emit('init', { agents, townTime });

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

// 模拟数据更新
let agents = [
  { id: 1, name: '张三', x: 5, y: 5, color: '#FF5733', moving: false },
  { id: 2, name: '李四', x: 15, y: 10, color: '#33A1FF', moving: false },
  { id: 3, name: '王五', x: 8, y: 18, color: '#33FF57', moving: false },
];

let townTime = { hour: 8, minute: 0 };

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

// 每2000毫秒更新agent位置
setInterval(() => {
  agents = agents.map(agent => {
    // 有20%的概率移动到新位置
    if (Math.random() < 0.2 && !agent.moving) {
      const randomDirection = Math.floor(Math.random() * 4); // 0: 上, 1: 右, 2: 下, 3: 左
      const moveDistance = Math.floor(Math.random() * 5) + 1; // 移动1-5步

      let newX = agent.x;
      let newY = agent.y;

      switch (randomDirection) {
        case 0: newY = Math.max(0, agent.y - moveDistance); break;
        case 1: newX = Math.min(800, agent.x + moveDistance); break;
        case 2: newY = Math.min(500, agent.y + moveDistance); break;
        case 3: newX = Math.max(0, agent.x - moveDistance); break;
      }

      return {
        ...agent,
        x: newX,
        y: newY,
        moving: true
      };
    }

    return {
      ...agent,
      moving: false
    };
  });

  const clientsCount = io.engine.clientsCount;
  if (clientsCount > 0) {
    io.emit('agentsUpdate', agents);
  }
}, 2000);

// 定期打印统计信息
setInterval(() => {
  const clientsCount = io.engine.clientsCount;
  console.log(`当前连接客户端数: ${clientsCount}`);
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