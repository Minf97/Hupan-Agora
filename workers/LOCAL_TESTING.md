# Cloudflare Workers 本地测试指南

## ✅ 修复完成

已修复的问题：
- ✅ "Callback returned incorrect type; expected 'Promise'" 异步错误
- ✅ Node.js 兼容性问题 (nodejs_compat)
- ✅ Durable Objects 迁移配置
- ✅ 本地开发环境完整配置

## 快速开始

### 1. 环境配置

```bash
# 进入 workers 目录
cd workers

# 复制环境变量配置文件
cp .dev.vars.example .dev.vars

# 编辑 .dev.vars 文件，填入你的配置
nano .dev.vars
```

### 2. 必需配置

在 `.dev.vars` 文件中设置以下变量：

```bash
# Supabase 数据库连接字符串 (必需)
DATABASE_URL="postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres?sslmode=require"

# OpenAI API Key (可选，用于更智能的对话)
OPENAI_API_KEY="sk-your-openai-api-key-here"

# 前端地址 (CORS 配置)
FRONTEND_URL="http://localhost:3000"
```

### 3. 启动本地服务器

```bash
# 方法1: 使用便捷脚本 (推荐)
./local-test.sh

# 方法2: 使用 npm 命令
npm run dev

# 方法3: 使用 wrangler 直接启动
wrangler dev --local --port 8787
```

## 测试端点

启动后可以测试以下端点：

### HTTP API
- **健康检查**: `GET http://localhost:8787/health`
- **获取所有代理**: `GET http://localhost:8787/api/agents`
- **更新代理状态**: `PUT http://localhost:8787/api/agents/:id`

### WebSocket 连接
- **WebSocket 端点**: `ws://localhost:8787/ws`
- ⚠️ **重要**: 不能在浏览器地址栏直接访问 WebSocket URL，这会返回 426 错误
- ✅ **正确使用**: 使用 JavaScript WebSocket API 或 WebSocket 客户端连接

### WebSocket 测试工具
使用提供的测试页面：
```bash
# 启动 workers 服务器
npm run dev

# 在另一个终端打开测试页面
open websocket-test.html
# 或使用测试脚本
./websocket-test.sh
```

## 测试示例

### 1. 健康检查
```bash
curl http://localhost:8787/health
# 返回: {"status":"ok","service":"websocket-server-supabase","timestamp":"..."}
```

### 2. 获取代理列表
```bash
curl http://localhost:8787/api/agents
```

### 3. WebSocket 连接测试

使用浏览器开发者工具或 WebSocket 客户端：

```javascript
const ws = new WebSocket('ws://localhost:8787/ws');

ws.onopen = function() {
    console.log('WebSocket 连接已建立');
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('收到消息:', data);
};

// 发送消息示例
ws.send(JSON.stringify({
    type: 'agentUpdate',
    payload: {
        agentId: 1,
        status: 'moving',
        position: { x: 100, y: 100 }
    }
}));
```

## 配置说明

### wrangler.toml 重要配置
```toml
compatibility_flags = ["nodejs_compat"]  # Node.js 兼容性
[[migrations]]                           # Durable Objects 迁移
tag = "v1"
new_classes = ["WebSocketSession"]
```

## 调试技巧

### 1. 查看实时日志
在另一个终端窗口中运行：
```bash
wrangler tail --local
```

### 2. 类型检查
```bash
npm run type-check
```

### 3. 数据库连接测试
确保你的 Supabase 数据库：
- 已创建对应的表结构
- 网络可访问（检查防火墙设置）
- 连接字符串格式正确

### 4. 端口检查
如果端口 8787 被占用：
```bash
lsof -ti:8787 | xargs kill -9  # 杀死占用端口的进程
```

## 常见问题

### Q: 访问 `ws://localhost:8787/ws` 返回 "426 (Upgrade Required)" 错误
A: ✅ 这是正常的！426 错误表示需要协议升级到 WebSocket。
- **原因**: 浏览器地址栏发送的是 HTTP 请求，不是 WebSocket 升级请求
- **解决**: 使用 JavaScript WebSocket API 连接：
  ```javascript
  const ws = new WebSocket('ws://localhost:8787/ws');
  ```
- **测试工具**: 使用提供的 `websocket-test.html` 或 `./websocket-test.sh`

### Q: "TypeError: Callback returned incorrect type; expected 'Promise'" 错误
A: ✅ 已修复！现在所有异步函数都正确处理 Promise 类型。

### Q: "No such module 'node:events'" 错误  
A: ✅ 已修复！已在 wrangler.toml 中启用 `nodejs_compat` 标志。

### Q: Durable Objects 迁移警告
A: ✅ 已修复！已添加 migrations 配置到 wrangler.toml。

### Q: 数据库连接失败
A: 检查 `.dev.vars` 中的 `DATABASE_URL` 是否正确，确保 Supabase 项目正在运行。

### Q: WebSocket 连接失败
A: 确保本地服务器正在运行在 http://localhost:8787，检查控制台日志。

### Q: CORS 错误
A: 检查 `.dev.vars` 中的 `FRONTEND_URL` 是否与前端应用地址匹配。

## 成功启动的标志

看到以下输出表示启动成功：
```
⛅️ wrangler 4.26.0
───────────────────
Using vars defined in .dev.vars
Your Worker has access to the following bindings:
...
⎔ Starting local server...
[wrangler:info] Ready on http://localhost:8787
```

## 部署到生产环境

当本地测试通过后，可以部署到 Cloudflare：

```bash
# 设置生产环境密钥
wrangler secret put DATABASE_URL
wrangler secret put OPENAI_API_KEY

# 部署
npm run deploy
```

## 故障排除

### 完全重置
如果遇到问题，可以完全重置：
```bash
# 停止所有进程
pkill -f wrangler

# 清理依赖
rm -rf node_modules package-lock.json
npm install

# 重新启动
./local-test.sh
```