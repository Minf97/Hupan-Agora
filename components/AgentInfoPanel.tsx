"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, User, Briefcase, Heart, MessageCircle, Clock, Smile, History } from 'lucide-react';
import { getAgentPersonality, type AgentPersonality } from '@/lib/agent-personality';
import { useAgentStore } from '@/store/agents';
import { ConversationHistory } from '@/components/ConversationHistory';

interface AgentInfoPanelProps {
  agentId: number | null;
  onClose: () => void;
  activeConversations: Map<string, any>;
  conversationMessages: Array<{
    speaker: string;
    content: string;
    timestamp: number;
    emotion?: string;
  }>;
}

// 获取头像的颜色（基于代理ID）
const getAvatarColor = (agentId: number) => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
    'bg-yellow-500', 'bg-indigo-500', 'bg-red-500', 'bg-teal-500'
  ];
  return colors[agentId % colors.length];
};

// 情绪图标映射
const getMoodIcon = (mood: string) => {
  const moodIcons = {
    happy: '😊',
    excited: '🤩',
    neutral: '😐',
    sad: '😢',
    tired: '😴',
    anxious: '😰'
  };
  return moodIcons[mood as keyof typeof moodIcons] || '😐';
};

// 格式化时间戳
const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
};

// 性格特征描述
const getTraitDescription = (trait: string, value: number) => {
  const descriptions = {
    extraversion: value > 0.7 ? '非常外向' : value > 0.4 ? '较为外向' : '比较内向',
    agreeableness: value > 0.7 ? '非常友善' : value > 0.4 ? '比较友善' : '相对冷淡',
    conscientiousness: value > 0.7 ? '非常认真' : value > 0.4 ? '比较负责' : '较为随性',
    neuroticism: value > 0.7 ? '情绪化' : value > 0.4 ? '情绪稳定' : '非常冷静',
    openness: value > 0.7 ? '思维开放' : value > 0.4 ? '接受新事物' : '较为保守'
  };
  return descriptions[trait as keyof typeof descriptions] || '';
};

export function AgentInfoPanel({ 
  agentId, 
  onClose, 
  activeConversations, 
  conversationMessages 
}: AgentInfoPanelProps) {
  const [personality, setPersonality] = useState<AgentPersonality | null>(null);
  const [currentConversation, setCurrentConversation] = useState<any>(null);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const { getAgentById } = useAgentStore();

  useEffect(() => {
    if (agentId) {
      // 获取代理的个性信息
      const agentPersonality = getAgentPersonality(agentId);
      setPersonality(agentPersonality);

      // 检查代理是否在对话中
      const conversation = Array.from(activeConversations.values()).find(
        (conv: any) => conv.agent1Id === agentId || conv.agent2Id === agentId
      );
      setCurrentConversation(conversation);

      // 获取相关的对话历史
      if (conversation) {
        console.log('🔍 检查对话历史:', {
          conversationId: conversation.id,
          agent1Name: conversation.agent1Name,
          agent2Name: conversation.agent2Name,
          totalMessages: conversationMessages.length,
          agentPersonalityName: agentPersonality.name
        });
        
        const relatedMessages = conversationMessages.filter(msg => {
          const isFromCurrentAgent = msg.speaker === agentPersonality.name;
          const isFromConversationPartner = msg.speaker === (conversation.agent1Id === agentId ? conversation.agent2Name : conversation.agent1Name);
          
          console.log('🔍 检查消息:', {
            speaker: msg.speaker,
            content: msg.content.substring(0, 30),
            isFromCurrentAgent,
            isFromConversationPartner,
            included: isFromCurrentAgent || isFromConversationPartner
          });
          
          return isFromCurrentAgent || isFromConversationPartner;
        });
        
        console.log('✅ 过滤后的相关消息数量:', relatedMessages.length);
        setConversationHistory(relatedMessages.slice(-20)); // 最近20条消息
      } else {
        // 没有当前对话时，显示该代理的所有历史消息
        const agentMessages = conversationMessages.filter(msg => 
          msg.speaker === agentPersonality.name
        );
        setConversationHistory(agentMessages.slice(-20));
      }
    }
  }, [agentId, activeConversations, conversationMessages]);

  if (!agentId || !personality) {
    return null;
  }

  const agent = getAgentById(agentId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] bg-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full ${getAvatarColor(agentId)} flex items-center justify-center text-white font-bold text-lg`}>
              {personality.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold">{personality.name}</h2>
              <p className="text-sm text-muted-foreground">{personality.occupation}</p>
            </div>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          <ScrollArea className="h-[60vh]">
            {/* 基础信息 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-500" />
                <span className="font-medium">基础信息</span>
              </div>
              <div className="pl-6 space-y-2">
                <p><span className="font-medium">年龄:</span> {personality.age} 岁</p>
                <p><span className="font-medium">职业:</span> {personality.occupation}</p>
                <p><span className="font-medium">背景:</span> {personality.background}</p>
                <div className="flex items-center gap-2">
                  <span className="font-medium">当前情绪:</span>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <span>{getMoodIcon(personality.mood)}</span>
                    {personality.mood}
                  </Badge>
                </div>
              </div>
            </div>

            {/* 性格特征 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="font-medium">性格特征</span>
              </div>
              <div className="pl-6 space-y-3">
                {Object.entries(personality.traits).map(([trait, value]) => (
                  <div key={trait} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium capitalize">
                        {trait === 'extraversion' && '外向性'}
                        {trait === 'agreeableness' && '宜人性'}
                        {trait === 'conscientiousness' && '尽责性'}
                        {trait === 'neuroticism' && '神经质'}
                        {trait === 'openness' && '开放性'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {getTraitDescription(trait, value)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${value * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 兴趣爱好 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Smile className="h-4 w-4 text-green-500" />
                <span className="font-medium">兴趣爱好</span>
              </div>
              <div className="pl-6 flex flex-wrap gap-2">
                {personality.interests.map((interest, index) => (
                  <Badge key={index} variant="secondary">
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 对话风格 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-purple-500" />
                <span className="font-medium">对话风格</span>
              </div>
              <div className="pl-6 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">正式程度</span>
                  <span className="text-sm text-muted-foreground">
                    {personality.conversationStyle.formality > 0.7 ? '非常正式' : 
                     personality.conversationStyle.formality > 0.4 ? '比较正式' : '比较随意'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">话多程度</span>
                  <span className="text-sm text-muted-foreground">
                    {personality.conversationStyle.verbosity > 0.7 ? '话很多' : 
                     personality.conversationStyle.verbosity > 0.4 ? '适中' : '比较简短'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">友好程度</span>
                  <span className="text-sm text-muted-foreground">
                    {personality.conversationStyle.friendliness > 0.7 ? '非常友好' : 
                     personality.conversationStyle.friendliness > 0.4 ? '比较友好' : '相对冷淡'}
                  </span>
                </div>
              </div>
            </div>

            {/* 当前对话和历史记录 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="font-medium">
                    {currentConversation ? '当前对话' : '对话历史'}
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowFullHistory(true)}
                >
                  <History className="h-3 w-3 mr-1" />
                  查看历史
                </Button>
              </div>
              
              {currentConversation && (
                <div className="pl-6">
                  <div className="bg-blue-50 rounded-lg p-3 mb-3">
                    <p className="text-sm font-medium text-blue-800">
                      正在与 {currentConversation.agent1Id === agentId ? 
                        currentConversation.agent2Name : currentConversation.agent1Name} 对话
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      对话开始时间: {formatTimestamp(currentConversation.startTime)}
                    </p>
                  </div>
                  
                  {/* 对话历史 */}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {conversationHistory.map((msg, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded-lg text-sm ${
                          msg.speaker === personality.name
                            ? 'bg-blue-100 ml-4'
                            : 'bg-gray-100 mr-4'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-xs">
                            {msg.speaker}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(msg.timestamp)}
                          </span>
                        </div>
                        <p>{msg.content}</p>
                        {msg.emotion && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {getMoodIcon(msg.emotion)} {msg.emotion}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {!currentConversation && (
                <div className="pl-6">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-muted-foreground">
                      {personality.name} 当前没有在对话中
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      点击上方按钮查看历史对话记录
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 状态信息 */}
            {agent && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">当前状态</span>
                </div>
                <div className="pl-6">
                  <Badge variant={agent.status === 'idle' ? 'secondary' : 'default'}>
                    {agent.status === 'idle' ? '空闲' : 
                     agent.status === 'moving' ? '移动中' :
                     agent.status === 'chatting' ? '对话中' :
                     agent.status === 'busy' ? '忙碌' : agent.status}
                  </Badge>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <p>位置: ({agent.x}, {agent.y})</p>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* 完整对话历史弹窗 */}
      {showFullHistory && personality && (
        <ConversationHistory
          agentId={agentId}
          agentName={personality.name}
          conversationMessages={conversationMessages}
          activeConversations={activeConversations}
          onClose={() => setShowFullHistory(false)}
        />
      )}
    </div>
  );
}