#!/bin/bash

# Cloudflare Workers + Supabase WebSocket 部署脚本
# Usage: ./deploy-cloudflare-supabase.sh

echo "🚀 开始部署 WebSocket 服务器到 Cloudflare Workers (连接 Supabase)..."

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

# 检查环境变量
echo "🔧 检查环境变量..."
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL 环境变量未设置"
    echo "请先设置你的 Supabase 数据库连接字符串:"
    echo "export DATABASE_URL=\"postgresql://postgres:[password]@[host]:[port]/[database]\""
    echo ""
    echo "或者使用 wrangler secret 设置:"
    echo "wrangler secret put DATABASE_URL"
    read -p "是否现在设置 DATABASE_URL？(y/n): " setup_db
    
    if [ "$setup_db" = "y" ] || [ "$setup_db" = "Y" ]; then
        echo "请输入你的 Supabase DATABASE_URL:"
        wrangler secret put DATABASE_URL
    else
        echo "❌ 无法继续部署，需要 DATABASE_URL"
        exit 1
    fi
fi

# 可选：设置 OpenAI API Key
read -p "是否设置 OpenAI API Key (用于 AI 对话生成)？(y/n): " setup_openai
if [ "$setup_openai" = "y" ] || [ "$setup_openai" = "Y" ]; then
    wrangler secret put OPENAI_API_KEY
fi

# 更新 wrangler.toml 中的前端 URL
echo "🌐 更新前端 URL..."
read -p "请输入你的前端 URL (例如: https://your-app.vercel.app): " frontend_url
if [ -n "$frontend_url" ]; then
    sed -i.bak "s|FRONTEND_URL = \"http://localhost:3000\"|FRONTEND_URL = \"$frontend_url\"|" wrangler.toml
    echo "✅ 已更新前端 URL: $frontend_url"
fi

# 部署到 Cloudflare
echo "🌐 部署到 Cloudflare Workers..."
wrangler deploy

# 获取部署的 URL
WORKER_NAME=$(grep "name = " wrangler.toml | cut -d'"' -f2)
echo ""
echo "🎉 部署完成!"
echo "📡 WebSocket 服务器地址: https://$WORKER_NAME.your-subdomain.workers.dev"
echo ""

# 测试健康检查
echo "🏥 测试健康检查..."
HEALTH_URL="https://$WORKER_NAME.your-subdomain.workers.dev/health"
if curl -f "$HEALTH_URL" &> /dev/null; then
    echo "✅ 健康检查通过"
else
    echo "❌ 健康检查失败，请检查部署状态"
fi

echo ""
echo "📋 接下来的步骤:"
echo ""
echo "1. 在 Vercel 项目中设置环境变量:"
echo "   NEXT_PUBLIC_CLOUDFLARE_WS_URL=https://$WORKER_NAME.your-subdomain.workers.dev"
echo ""
echo "2. 在前端代码中替换 WebSocket hook:"
echo "   // 在 hooks/useSocketManager.ts 中"
echo "   import { useCloudflareSocket } from \"./useCloudflareSocket\";"
echo "   // 替换 useSocket 为 useCloudflareSocket"
echo ""
echo "3. 部署前端到 Vercel:"
echo "   cd .."
echo "   vercel --prod"
echo ""
echo "4. 测试 WebSocket 连接:"
echo "   打开浏览器开发者工具，查看 WebSocket 连接状态"
echo ""
echo "🔍 实时日志: wrangler tail $WORKER_NAME"
echo "📊 指标监控: wrangler metrics $WORKER_NAME"