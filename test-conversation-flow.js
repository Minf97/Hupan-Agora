// Test script to verify the conversation flow
const WebSocket = require('ws');

const testConversationFlow = () => {
  console.log('🧪 测试对话流程...');
  
  // 连接到 Cloudflare Worker WebSocket
  const ws = new WebSocket('ws://localhost:8787/ws');
  
  ws.on('open', () => {
    console.log('✅ WebSocket 连接成功');
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📨 收到消息:', {
        type: message.type,
        payload: message.payload
      });
      
      // 如果收到对话消息，显示详细信息
      if (message.type === 'conversation_message') {
        const { conversationId, speaker, content, timestamp, emotion } = message.payload;
        console.log(`💬 对话消息: ${speaker}: "${content}" [${emotion}] @ ${new Date(timestamp).toLocaleTimeString()}`);
      }
      
      // 如果收到对话开始，记录
      if (message.type === 'conversation_start') {
        console.log(`🎭 对话开始: ${message.payload.agent1Name} ↔ ${message.payload.agent2Name}`);
      }
      
      // 如果收到对话结束，记录
      if (message.type === 'conversation_end') {
        console.log(`🔚 对话结束: Agent ${message.payload.agent1} ↔ Agent ${message.payload.agent2}`);
      }
      
    } catch (error) {
      console.error('❌ 解析消息失败:', error);
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket 错误:', error);
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket 连接关闭');
  });
  
  // 30秒后关闭测试
  setTimeout(() => {
    console.log('⏰ 测试结束，关闭连接');
    ws.close();
  }, 30000);
};

testConversationFlow();