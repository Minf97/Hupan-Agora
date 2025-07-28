#!/bin/bash
# websocket-test.sh - WebSocket 连接测试脚本

echo "🧪 WebSocket 连接测试"
echo "===================="

# 启动服务器
echo "1. 启动 Cloudflare Workers 本地服务器..."
npm run dev &
SERVER_PID=$!

# 等待服务器启动
echo "   等待服务器启动..."
sleep 5

# 测试健康检查
echo "2. 测试健康检查端点..."
HEALTH_RESPONSE=$(curl -s http://localhost:8787/health)
if [[ $? -eq 0 ]]; then
    echo "   ✅ 健康检查成功: $HEALTH_RESPONSE"
else
    echo "   ❌ 健康检查失败"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo ""
echo "3. WebSocket 连接信息:"
echo "   📡 WebSocket 地址: ws://localhost:8787/ws"
echo "   🌐 HTTP API 地址: http://localhost:8787/api/"
echo "   ❤️  健康检查地址: http://localhost:8787/health"
echo ""

echo "4. 测试说明:"
echo "   - 打开浏览器访问: file://$(pwd)/websocket-test.html"
echo "   - 或者在前端应用中使用 useCloudflareSocket hook"
echo "   - WebSocket 连接不应再显示 426 错误"
echo ""

echo "5. 常用测试命令:"
echo "   curl http://localhost:8787/health                    # 健康检查"
echo "   curl http://localhost:8787/api/agents                # 获取代理列表"
echo ""

echo "⏰ 服务器将在 30 秒后自动停止..."
echo "   按 Ctrl+C 可立即停止"

# 等待或被中断
sleep 30 &
SLEEP_PID=$!

# 处理中断信号
trap 'kill $SLEEP_PID 2>/dev/null; kill $SERVER_PID 2>/dev/null; echo ""; echo "🛑 服务器已停止"; exit 0' INT

wait $SLEEP_PID 2>/dev/null

# 停止服务器
kill $SERVER_PID 2>/dev/null
echo ""
echo "✅ 测试完成，服务器已停止"