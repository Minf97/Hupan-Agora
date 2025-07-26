"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Clock, Users, X } from 'lucide-react';

interface ConversationMessage {
  speaker: string;
  content: string;
  timestamp: number;
  emotion?: string;
  agentId?: number;
}

interface MemoryRecord {
  id: number;
  agentId: number;
  content: string;
  type: string;
  importance: number;
  createdAt: Date;
}

interface ConversationHistoryProps {
  agentId: number;
  agentName: string;
  conversationMessages: ConversationMessage[];
  activeConversations: Map<string, any>;
  onClose: () => void;
}

// 情绪图标映射
const getEmotionIcon = (emotion?: string) => {
  if (!emotion) return '';
  const emotionIcons = {
    happy: '😊',
    excited: '🤩',
    neutral: '😐',
    sad: '😢',
    tired: '😴',
    anxious: '😰',
    angry: '😠',
    surprised: '😲',
    confused: '😕'
  };
  return emotionIcons[emotion as keyof typeof emotionIcons] || '';
};

// 格式化时间戳
const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - timestamp;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 格式化详细时间
const formatDetailedTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export function ConversationHistory({
  agentId,
  agentName,
  conversationMessages,
  activeConversations,
  onClose
}: ConversationHistoryProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'recent' | 'hour' | 'day' | 'all'>('recent');
  const [filteredMessages, setFilteredMessages] = useState<ConversationMessage[]>([]);
  const [currentConversation, setCurrentConversation] = useState<any>(null);
  const [memoryConversations, setMemoryConversations] = useState<MemoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // 从memory系统加载对话记录
  const loadConversationMemories = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/memories?agentId=${agentId}&type=conversation&limit=50`);
      if (response.ok) {
        const memories = await response.json();
        setMemoryConversations(memories);
      }
    } catch (error) {
      console.error('加载对话记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversationMemories();
  }, [agentId]);

  useEffect(() => {
    // 查找当前对话
    const conversation = Array.from(activeConversations.values()).find(
      (conv: any) => conv.agent1Id === agentId || conv.agent2Id === agentId
    );
    setCurrentConversation(conversation);

    // 过滤实时消息（保留用于显示当前对话）
    let messages = conversationMessages.filter(msg => 
      msg.speaker === agentName || 
      (conversation && (
        msg.speaker === conversation.agent1Name || 
        msg.speaker === conversation.agent2Name
      ))
    );

    // 根据时间范围过滤
    const now = Date.now();
    switch (selectedTimeRange) {
      case 'recent':
        messages = messages.slice(-20);
        break;
      case 'hour':
        messages = messages.filter(msg => now - msg.timestamp < 60 * 60 * 1000);
        break;
      case 'day':
        messages = messages.filter(msg => now - msg.timestamp < 24 * 60 * 60 * 1000);
        break;
      case 'all':
        messages = messages.slice(-100);
        break;
    }

    setFilteredMessages(messages);
  }, [agentId, agentName, conversationMessages, activeConversations, selectedTimeRange]);

  // 按对话分组消息
  const groupMessagesByConversation = (messages: ConversationMessage[]) => {
    const grouped: { [key: string]: ConversationMessage[] } = {};
    
    messages.forEach(msg => {
      // 简单的对话分组逻辑：基于时间间隔
      const timestamp = msg.timestamp;
      const timeGroup = Math.floor(timestamp / (5 * 60 * 1000)); // 5分钟为一组
      const key = `conversation_${timeGroup}`;
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(msg);
    });
    
    return grouped;
  };

  const messageGroups = groupMessagesByConversation(filteredMessages);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] bg-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 text-blue-500" />
            <div>
              <h2 className="text-xl font-bold">{agentName} 的对话记录</h2>
              <p className="text-sm text-muted-foreground">
                {currentConversation 
                  ? `正在与 ${currentConversation.agent1Id === agentId ? currentConversation.agent2Name : currentConversation.agent1Name} 对话中`
                  : '暂无进行中的对话'
                }
              </p>
            </div>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 时间范围选择器 */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedTimeRange === 'recent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange('recent')}
            >
              最近消息
            </Button>
            <Button
              variant={selectedTimeRange === 'hour' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange('hour')}
            >
              过去1小时
            </Button>
            <Button
              variant={selectedTimeRange === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange('day')}
            >
              过去24小时
            </Button>
            <Button
              variant={selectedTimeRange === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange('all')}
            >
              所有记录
            </Button>
          </div>

          {/* 当前对话状态 */}
          {currentConversation && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">进行中的对话</span>
              </div>
              <div className="text-sm text-blue-700">
                <p>对话参与者: {currentConversation.agent1Name} ↔ {currentConversation.agent2Name}</p>
                <p>开始时间: {formatDetailedTime(currentConversation.startTime)}</p>
                <p>对话ID: {currentConversation.id}</p>
              </div>
            </div>
          )}

          {/* 对话历史 */}
          <ScrollArea className="h-[50vh]">
            <div className="space-y-4">
              {/* 当前实时对话 */}
              {filteredMessages.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-green-600 flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    当前对话
                  </h3>
                  {filteredMessages.map((msg, index) => (
                    <div key={index} className="bg-green-50 rounded-lg p-3 border-l-4 border-green-400">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-green-800">{msg.speaker}</span>
                        <span className="text-xs text-green-600">
                          {formatDetailedTime(msg.timestamp)}
                        </span>
                      </div>
                      <p className="text-gray-700">{msg.content}</p>
                      {msg.emotion && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {getEmotionIcon(msg.emotion)} {msg.emotion}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 历史对话记录（从memory系统） */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  历史对话记录
                  {loading && <span className="text-xs text-gray-400">(加载中...)</span>}
                </h3>
                
                {memoryConversations.length === 0 && !loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>暂无对话记录</p>
                  </div>
                ) : (
                  memoryConversations.map((memory) => (
                    <div key={memory.id} className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-400">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-800">{agentName}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            重要性: {memory.importance}
                          </Badge>
                          <span className="text-xs text-gray-600">
                            {formatDetailedTime(new Date(memory.createdAt).getTime())}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-700 text-sm">
                        {memory.content.replace('对话: ', '')}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </ScrollArea>

          {/* 统计信息 */}
          <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>当前对话: {filteredMessages.length} 条 | 历史记录: {memoryConversations.length} 条</span>
            <span>
              {memoryConversations.length > 0 && 
                `最新记录: ${formatTimestamp(new Date(memoryConversations[0].createdAt).getTime())}`
              }
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}