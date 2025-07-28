#!/bin/bash
# local-test.sh - 本地测试脚本

echo "🚀 启动 Cloudflare Workers 本地测试环境..."

# 检查是否存在 .dev.vars 文件
if [ ! -f "./.dev.vars" ]; then
    echo "❌ 未找到 .dev.vars 文件"
    echo "请参考 .dev.vars.example 创建 .dev.vars 文件并配置环境变量"
    echo ""
    echo "基本步骤:"
    echo "1. cp .dev.vars.example .dev.vars"
    echo "2. 编辑 .dev.vars 文件，填入你的 Supabase 数据库连接字符串"
    echo "3. (可选) 添加 OpenAI API Key"
    echo ""
    exit 1
fi

# 检查数据库连接字符串是否已配置
if grep -q "your-password\|your-host\|your-project" .dev.vars; then
    echo "⚠️  检测到 .dev.vars 文件中还有占位符"
    echo "请确保已经将占位符替换为实际的数据库连接信息"
    echo ""
fi

# 检查 wrangler 是否安装
if ! command -v wrangler &> /dev/null; then
    echo "❌ 未找到 wrangler CLI"
    echo "正在安装 wrangler..."
    npm install -g wrangler
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

echo "✅ 环境检查完成"
echo ""
echo "🔧 配置信息:"
echo "- Node.js 兼容性: 已启用"
echo "- Durable Objects: WebSocketSession"
echo "- 本地端口: 8787"
echo ""
echo "🌐 启动本地开发服务器..."
echo "WebSocket 服务器地址: ws://localhost:8787/ws"
echo "API 地址: http://localhost:8787/api/"
echo "健康检查: http://localhost:8787/health"
echo ""
echo "💡 提示: 启动后可以在另一个终端中运行以下命令测试："
echo "curl http://localhost:8787/health"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

# 启动本地开发服务器
npm run dev