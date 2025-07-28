#!/bin/bash

echo "🔍 WebSocket 连接问题诊断"
echo "========================="

# 检查端口占用
echo "1. 检查端口占用情况:"
lsof -i :8787 | head -10

echo ""
echo "2. 检查 Workers 服务器状态:"
curl -s http://localhost:8787/health 2>/dev/null && echo "✅ HTTP 服务正常" || echo "❌ HTTP 服务异常"

echo ""
echo "3. 测试 WebSocket 升级请求:"
echo "   使用 curl 模拟 WebSocket 握手..."
curl -v -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" http://localhost:8787/ws 2>&1 | head -20

echo ""
echo "4. 环境变量检查:"
echo "   请在前端应用中检查这些环境变量:"
echo "   - NEXT_PUBLIC_CLOUDFLARE_WS_URL"
echo "   - NEXT_PUBLIC_WS_URL"

echo ""
echo "5. 调试建议:"
echo "   - 访问 http://localhost:3000/websocket-test"
echo "   - 打开浏览器开发者工具查看 Console 和 Network 标签"
echo "   - 查看 WebSocket 连接请求的详细信息"

echo ""
echo "6. 如果仍有问题，请检查:"
echo "   - Next.js 开发服务器是否在运行 (npm run dev)"
echo "   - Workers 服务器是否在运行 (cd workers && npm run dev)"
echo "   - 环境变量是否正确加载"