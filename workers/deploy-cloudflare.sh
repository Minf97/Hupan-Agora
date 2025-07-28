#!/bin/bash

# Cloudflare WebSocket 部署脚本
# Usage: ./deploy-cloudflare.sh

echo "🚀 开始部署 WebSocket 服务器到 Cloudflare Workers..."

# 检查是否安装了 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ 未找到 wrangler CLI，正在安装..."
    npm install -g wrangler
fi

# 检查是否已登录
echo "📝 检查 Cloudflare 登录状态..."
if ! wrangler whoami &> /dev/null; then
    echo "🔐 请先登录 Cloudflare..."
    wrangler login
fi

cd workers

# 安装依赖
echo "📦 安装依赖..."
npm install

# 创建 D1 数据库
echo "🗄️ 创建 D1 数据库..."
DB_OUTPUT=$(wrangler d1 create hackthon-x-db)
DB_ID=$(echo "$DB_OUTPUT" | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2)

if [ -n "$DB_ID" ]; then
    echo "✅ 数据库创建成功，ID: $DB_ID"
    # 更新 wrangler.toml
    sed -i.bak "s/database_id = \"your-d1-database-id\"/database_id = \"$DB_ID\"/" wrangler.toml
    echo "📝 已更新 wrangler.toml 中的数据库 ID"
else
    echo "⚠️  数据库可能已存在，继续执行..."
fi

# 创建 KV 命名空间
echo "🔑 创建 KV 命名空间..."
KV_OUTPUT=$(wrangler kv:namespace create "KV")
KV_ID=$(echo "$KV_OUTPUT" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)

if [ -n "$KV_ID" ]; then
    echo "✅ KV 命名空间创建成功，ID: $KV_ID"
    # 更新 wrangler.toml
    sed -i.bak "s/id = \"your-kv-namespace-id\"/id = \"$KV_ID\"/" wrangler.toml
    echo "📝 已更新 wrangler.toml 中的 KV ID"
fi

# 运行数据库迁移
echo "📊 执行数据库迁移..."
wrangler d1 execute hackthon-x-db --file=./schema.sql

# 部署到 Cloudflare
echo "🌐 部署到 Cloudflare Workers..."
wrangler deploy

# 获取部署的 URL
WORKER_NAME=$(grep "name = " wrangler.toml | cut -d'"' -f2)
echo ""
echo "🎉 部署完成!"
echo "📡 WebSocket 服务器地址: https://$WORKER_NAME.your-subdomain.workers.dev"
echo ""
echo "📋 接下来的步骤:"
echo "1. 在 Vercel 中设置环境变量:"
echo "   NEXT_PUBLIC_CLOUDFLARE_WS_URL=https://$WORKER_NAME.your-subdomain.workers.dev"
echo ""
echo "2. 在 useSocketManager.ts 中替换 useSocket 为 useCloudflareSocket"
echo ""
echo "3. 测试连接:"
echo "   curl https://$WORKER_NAME.your-subdomain.workers.dev/health"
echo ""
echo "🔍 查看日志: wrangler tail $WORKER_NAME"