# Cloudflare Workers WebSocket 部署指南

## 1. 环境准备

首先确保你有 Cloudflare 账户并安装了 Wrangler CLI：

```bash
npm install -g wrangler
wrangler login
```

## 2. 创建 D1 数据库

```bash
# 创建 D1 数据库
wrangler d1 create hackthon-x-db

# 获取数据库 ID，并更新 wrangler.toml 中的 database_id
```

## 3. 运行数据库迁移

```bash
cd workers

# 创建数据库表
wrangler d1 execute hackthon-x-db --file=./schema.sql
```

## 4. 创建 KV 命名空间

```bash
# 创建 KV 命名空间用于临时状态存储
wrangler kv:namespace create "KV"

# 更新 wrangler.toml 中的 KV namespace ID
```

## 5. 安装依赖并部署

```bash
cd workers
npm install
npm run deploy
```

## 6. 更新前端环境变量

在你的 Next.js 项目中，更新环境变量：

```bash
# .env.local (开发环境)
NEXT_PUBLIC_CLOUDFLARE_WS_URL=https://your-worker-name.your-subdomain.workers.dev

# Vercel 环境变量设置
NEXT_PUBLIC_CLOUDFLARE_WS_URL=https://your-worker-name.your-subdomain.workers.dev
```

## 7. 更新前端代码

将 `useSocket` 替换为 `useCloudflareSocket`：

```typescript
// 在 useSocketManager.ts 中
import { useCloudflareSocket } from "./useCloudflareSocket";

// 替换
const { socket, connectionStatus, reportTaskComplete } = useCloudflareSocket({
  // ... 相同的回调函数
});
```

## 8. 测试连接

```bash
# 本地测试
cd workers
npm run dev

# 在另一个终端测试连接
curl https://your-worker-url/health
```

## 9. 监控和日志

```bash
# 查看实时日志
wrangler tail your-worker-name

# 查看指标
wrangler metrics your-worker-name
```

## 配置文件说明

### wrangler.toml
- `name`: Worker 名称
- `main`: 入口文件
- `compatibility_date`: API 兼容性日期
- `durable_objects`: WebSocket 会话管理
- `d1_databases`: 数据库配置
- `kv_namespaces`: 键值存储配置

### 环境变量
- `FRONTEND_URL`: 前端应用 URL（用于 CORS）
- `NEXT_PUBLIC_CLOUDFLARE_WS_URL`: WebSocket 服务器 URL

## 故障排除

1. **连接失败**: 检查 WebSocket URL 格式，确保使用 `wss://` 协议
2. **CORS 错误**: 在 wrangler.toml 中正确配置 `FRONTEND_URL`
3. **数据库错误**: 确保 D1 数据库已正确创建和迁移
4. **权限问题**: 确保 Cloudflare 账户有足够权限创建资源

## 成本优化

- Cloudflare Workers 有免费额度：每天 100,000 次请求
- D1 数据库免费额度：每月 25 GB 存储，50 亿次读取
- WebSocket 连接按时间计费，适合实时应用

## 下一步

部署完成后，你的 WebSocket 服务器将运行在 Cloudflare 的全球网络上，提供：
- 低延迟连接
- 自动扩缩容
- 全球分布
- 高可用性