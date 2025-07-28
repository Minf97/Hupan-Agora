# Cloudflare Workers + Supabase WebSocket 部署指南

## 🏗️ 架构概览

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│                 │    │                  │    │                 │
│  Next.js 前端   │    │ Cloudflare       │    │   Supabase      │
│  (Vercel)       │────│ Workers          │────│   PostgreSQL    │
│                 │    │ WebSocket        │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login
```

### 2. 一键部署

```bash
cd workers
./deploy-cloudflare-supabase.sh
```

## 📝 手动部署步骤

### 第一步：准备 Supabase 数据库

1. **获取数据库连接字符串**
   ```
   postgresql://postgres:[password]@[host]:[port]/[database]
   ```

2. **确保现有表结构兼容**
   - ✅ `agents` 表已存在
   - ✅ `thoughts` 表已存在  
   - ✅ 数据库连接正常

### 第二步：配置 Cloudflare Workers

1. **设置环境变量**
   ```bash
   cd workers
   
   # 设置数据库连接
   wrangler secret put DATABASE_URL
   # 输入你的 Supabase 连接字符串
   
   # 可选：设置 OpenAI API Key
   wrangler secret put OPENAI_API_KEY
   ```

2. **更新 wrangler.toml**
   ```toml
   name = "hackthon-x-websocket"
   main = "src/index.ts"
   compatibility_date = "2024-01-01"

   [vars]
   FRONTEND_URL = "https://your-app.vercel.app"

   [[durable_objects.bindings]]
   name = "WEBSOCKET_SESSIONS"
   class_name = "WebSocketSession"
   ```

3. **安装依赖并部署**
   ```bash
   npm install
   wrangler deploy
   ```

### 第三步：更新前端代码

1. **替换 WebSocket Hook**
   ```typescript
   // 在 hooks/useSocketManager.ts 中
   import { useCloudflareSocket } from "./useCloudflareSocket";
   
   // 替换这行：
   // const { socket, connectionStatus, reportTaskComplete } = useSocket({
   
   // 改为：
   const { socket, connectionStatus, reportTaskComplete } = useCloudflareSocket({
     // ... 保持回调函数不变
   });
   ```

2. **设置环境变量**
   ```bash
   # .env.local (本地开发)
   NEXT_PUBLIC_CLOUDFLARE_WS_URL=http://localhost:8787
   
   # Vercel 环境变量
   NEXT_PUBLIC_CLOUDFLARE_WS_URL=https://your-worker.your-subdomain.workers.dev
   ```

### 第四步：部署前端

```bash
# 部署到 Vercel
vercel --prod
```

## 🔧 配置说明

### Cloudflare Workers 环境变量

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `DATABASE_URL` | ✅ | Supabase PostgreSQL 连接字符串 |
| `OPENAI_API_KEY` | ❌ | OpenAI API Key (用于 AI 对话生成) |
| `FRONTEND_URL` | ✅ | 前端应用 URL (用于 CORS) |

### 前端环境变量

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `NEXT_PUBLIC_CLOUDFLARE_WS_URL` | ✅ | Cloudflare Workers WebSocket URL |

## 🧪 测试和验证

### 1. 健康检查
```bash
curl https://your-worker.your-subdomain.workers.dev/health
# 应该返回: {"status":"ok","service":"websocket-server-supabase"}
```

### 2. API 端点测试
```bash
# 获取所有 agents
curl https://your-worker.your-subdomain.workers.dev/api/agents

# 更新 agent 状态
curl -X PUT https://your-worker.your-subdomain.workers.dev/api/agents/1 \
  -H "Content-Type: application/json" \
  -d '{"status":"idle","x":10,"y":20}'
```

### 3. WebSocket 连接测试
- 打开浏览器开发者工具
- 查看 Network 标签页中的 WebSocket 连接
- 确认连接状态为 "101 Switching Protocols"

## 📊 监控和日志

### 实时日志
```bash
wrangler tail your-worker-name
```

### 性能指标
```bash
wrangler metrics your-worker-name
```

### Cloudflare Dashboard
- 访问 [Cloudflare Dashboard](https://dash.cloudflare.com)
- 查看 Workers & Pages > Overview
- 监控请求量、错误率、响应时间

## 🐛 故障排除

### 常见问题

#### 1. WebSocket 连接失败
**症状**: 前端显示"连接错误"
**解决方案**:
- 检查 `NEXT_PUBLIC_CLOUDFLARE_WS_URL` 是否正确
- 确认 WebSocket URL 使用 `wss://` 协议
- 检查 Cloudflare Workers 是否正常部署

#### 2. 数据库连接错误
**症状**: Workers 日志显示数据库连接失败
**解决方案**:
```bash
# 重新设置数据库连接字符串
wrangler secret put DATABASE_URL

# 确认 Supabase 数据库可访问
psql "your-database-url" -c "SELECT 1;"
```

#### 3. CORS 错误
**症状**: 浏览器控制台显示 CORS 错误
**解决方案**:
- 在 `wrangler.toml` 中正确设置 `FRONTEND_URL`
- 确认前端域名在 CORS 配置中

#### 4. Durable Objects 错误
**症状**: WebSocket 连接建立后立即断开
**解决方案**:
- 检查 Durable Objects 绑定配置
- 确认 Worker 有 Durable Objects 权限

### 调试技巧

1. **查看实时日志**
   ```bash
   wrangler tail your-worker-name --format=pretty
   ```

2. **本地调试**
   ```bash
   cd workers
   wrangler dev --local
   ```

3. **检查 Worker 状态**
   ```bash
   wrangler status your-worker-name
   ```

## 💰 成本优化

### Cloudflare Workers 免费额度
- **请求数**: 每天 100,000 次请求
- **CPU 时间**: 每天 10ms × 100,000 = 1000 秒
- **Durable Objects**: 每月 1,000,000 次请求

### Supabase 免费额度
- **数据库**: 500MB 存储
- **API 请求**: 每月 50,000 次
- **实时连接**: 2 个并发连接

### 成本监控
- 在 Cloudflare Dashboard 中查看用量
- 设置用量告警避免超出免费额度
- 使用 Supabase Dashboard 监控数据库用量

## 🔄 升级和维护

### 更新部署
```bash
cd workers
git pull
npm install
wrangler deploy
```

### 数据库迁移
如需修改数据库结构：
1. 在 Supabase Dashboard 中执行 SQL
2. 或使用现有的 Drizzle 迁移系统

### 监控告警
- 设置 Cloudflare 告警规则
- 监控 WebSocket 连接数
- 跟踪数据库查询性能

## 🔗 相关链接

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Supabase 文档](https://supabase.com/docs)
- [Hono 框架文档](https://hono.dev/)
- [Drizzle ORM 文档](https://orm.drizzle.team/)

---

**🎯 部署完成后，你将拥有：**
- ✅ 全球分布式 WebSocket 服务器
- ✅ 零服务器管理
- ✅ 保持现有 Supabase 数据库
- ✅ 低延迟实时通信
- ✅ 自动扩缩容