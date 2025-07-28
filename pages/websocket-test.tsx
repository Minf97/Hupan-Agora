import { useEffect, useState } from 'react';
import { useCloudflareSocket } from '@/hooks/useCloudflareSocket';

export default function WebSocketTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [agents, setAgents] = useState<any[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const { socket, connectionStatus } = useCloudflareSocket({
    onConnect: () => {
      addLog('✅ WebSocket 连接成功');
    },
    onConnectError: (err) => {
      addLog(`❌ 连接错误: ${err.message}`);
    },
    onInit: (initialAgents, townTime) => {
      addLog(`📊 收到初始数据: ${initialAgents.length} 个代理`);
      setAgents(initialAgents);
    },
    onTimeUpdate: (newTime) => {
      addLog(`⏰ 时间更新: ${newTime.hour}:${newTime.minute.toString().padStart(2, '0')}`);
    },
    onAgentTask: (task) => {
      addLog(`📋 代理任务: Agent ${task.agentId}`);
    },
    onConversationStart: (data) => {
      addLog(`💬 对话开始: ${data.agent1Name} vs ${data.agent2Name}`);
    },
    onConversationEnd: (data) => {
      addLog(`🔚 对话结束: 持续 ${Math.floor(data.duration / 1000)}秒`);
    },
    onConversationMessage: (data) => {
      addLog(`📝 对话消息: ${data.message.speaker}: ${data.message.content}`);
    },
    onStopAgentMovement: (data) => {
      addLog(`⏹️ 停止代理移动: Agent ${data.agentId}`);
    },
    onAgentStateUpdate: (data) => {
      addLog(`🔄 代理状态更新: Agent ${data.agentId} -> ${data.status} at (${data.position.x}, ${data.position.y})`);
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">WebSocket 连接测试</h1>
      
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">连接状态</h2>
        <div className={`p-3 rounded ${
          connectionStatus.includes('已连接') ? 'bg-green-100 text-green-800' :
          connectionStatus.includes('错误') ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {connectionStatus}
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">环境变量检查</h2>
        <div className="bg-gray-100 p-3 rounded font-mono text-sm">
          <div>NEXT_PUBLIC_CLOUDFLARE_WS_URL: {process.env.NEXT_PUBLIC_CLOUDFLARE_WS_URL || '未设置'}</div>
          <div>NEXT_PUBLIC_WS_URL: {process.env.NEXT_PUBLIC_WS_URL || '未设置'}</div>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">代理列表 ({agents.length})</h2>
        <div className="bg-gray-100 p-3 rounded max-h-40 overflow-y-auto">
          {agents.length > 0 ? (
            <ul className="space-y-1">
              {agents.map(agent => (
                <li key={agent.id} className="text-sm">
                  {agent.name} - {agent.status} at ({agent.position.x}, {agent.position.y})
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-gray-500">暂无代理数据</div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">测试操作</h2>
        <div className="space-x-2">
          <button 
            onClick={() => socket?.emit('ping', { timestamp: Date.now() })}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={!socket}
          >
            发送 Ping
          </button>
          <button 
            onClick={() => socket?.emit('agentUpdate', { 
              agentId: 1, 
              status: 'moving', 
              position: { x: Math.floor(Math.random() * 100), y: Math.floor(Math.random() * 100) }
            })}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            disabled={!socket}
          >
            模拟代理移动
          </button>
          <button 
            onClick={() => setLogs([])}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            清空日志
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">连接日志</h2>
        <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))
          ) : (
            <div className="text-gray-500">暂无日志</div>
          )}
        </div>
      </div>
    </div>
  );
}