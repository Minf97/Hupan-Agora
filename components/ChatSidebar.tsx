"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { X, Send } from 'lucide-react';

interface ChatSidebarProps {
  agentId: number;
  agentName: string;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}

export default function ChatSidebar({ agentId, agentName, onClose }: ChatSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 加载聊天历史
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const response = await fetch(`/api/agents/${agentId}/chat`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setMessages(result.data.messages || []);
          }
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    if (agentId) {
      loadChatHistory();
    }
  }, [agentId]);

  // 发送消息
  const sendMessage = async () => {
    if (!newMessage.trim() || loading) return;

    const userMessage = newMessage.trim();
    setNewMessage('');
    setLoading(true);

    try {
      const response = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 添加用户消息和代理回复
          setMessages(prev => [
            ...prev,
            result.data.userMessage,
            result.data.agentMessage
          ]);
        }
      } else {
        console.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理回车键发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed right-0 top-0 w-[29vw] h-[100vh] bg-white shadow-2xl z-50 border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-blue-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
            {agentName.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">与 {agentName} 聊天</h2>
            <p className="text-sm text-gray-600">在线</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="w-8 h-8 rounded-full hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">加载聊天记录中...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <div className="mb-4">💬</div>
                <p>还没有聊天记录</p>
                <p className="text-sm">开始和 {agentName} 对话吧！</p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] p-3 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          message.role === 'user'
                            ? 'text-blue-100'
                            : 'text-gray-500'
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-bl-sm p-3 max-w-[70%]">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`给 ${agentName} 发消息...`}
            disabled={loading}
            className="flex-1 rounded-full border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || loading}
            size="sm"
            className="rounded-full w-10 h-10 p-0 bg-blue-500 hover:bg-blue-600"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          按 Enter 发送，Shift + Enter 换行
        </p>
      </div>
    </div>
  );
}