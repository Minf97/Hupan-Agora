// components/MemoryPanel.tsx - 记忆面板组件

"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Brain, 
  Search, 
  Eye, 
  MessageCircle, 
  Target, 
  Heart, 
  Lightbulb,
  Star,
  X, 
  Minimize2, 
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { useMemoryManager, type MemoryRecord } from '@/hooks/useMemoryManager';

interface MemoryPanelProps {
  agentId?: number;
  className?: string;
}

export function MemoryPanel({ agentId, className }: MemoryPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MemoryRecord['type'] | 'all'>('all');
  const [showSearch, setShowSearch] = useState(false);
  
  const {
    memories,
    searchResults,
    isLoading,
    error,
    loadMemories,
    searchMemories,
    getMemoriesByType,
    getImportantMemories,
  } = useMemoryManager(agentId);

  if (!isVisible) return null;

  // 获取图标
  const getTypeIcon = (type: MemoryRecord['type']) => {
    switch (type) {
      case 'observation':
        return <Eye className="h-3 w-3" />;
      case 'thought':
        return <Brain className="h-3 w-3" />;
      case 'conversation':
        return <MessageCircle className="h-3 w-3" />;
      case 'reflection':
        return <Lightbulb className="h-3 w-3" />;
      case 'goal':
        return <Target className="h-3 w-3" />;
      case 'emotion':
        return <Heart className="h-3 w-3" />;
      default:
        return <Brain className="h-3 w-3" />;
    }
  };

  // 获取类型颜色
  const getTypeColor = (type: MemoryRecord['type']) => {
    switch (type) {
      case 'observation':
        return 'bg-gray-100 text-gray-800';
      case 'thought':
        return 'bg-blue-100 text-blue-800';
      case 'conversation':
        return 'bg-green-100 text-green-800';
      case 'reflection':
        return 'bg-yellow-100 text-yellow-800';
      case 'goal':
        return 'bg-purple-100 text-purple-800';
      case 'emotion':
        return 'bg-pink-100 text-pink-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 获取类型名称
  const getTypeName = (type: MemoryRecord['type']) => {
    switch (type) {
      case 'observation':
        return '观察';
      case 'thought':
        return '思考';
      case 'conversation':
        return '对话';
      case 'reflection':
        return '反思';
      case 'goal':
        return '目标';
      case 'emotion':
        return '情绪';
      default:
        return '未知';
    }
  };

  // 获取重要性星级
  const getImportanceStars = (importance: number) => {
    return Array.from({ length: Math.min(importance, 5) }, (_, i) => (
      <Star key={i} className="h-2 w-2 fill-yellow-400 text-yellow-400" />
    ));
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 处理搜索
  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await searchMemories(searchQuery.trim());
      setShowSearch(true);
    }
  };

  // 生成反思记忆
  const generateReflection = async () => {
    if (!agentId) return;

    try {
      const response = await fetch('/api/memories/reflection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          thoughtCount: 10,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // 刷新记忆列表
        await loadMemories();
        console.log('✨ 反思记忆已生成:', result.data.content);
      } else {
        console.error('生成反思失败:', result.error);
      }
    } catch (error) {
      console.error('生成反思失败:', error);
    }
  };

  // 获取显示的记忆列表
  const getDisplayMemories = () => {
    if (showSearch && searchResults.length > 0) {
      return searchResults;
    }
    
    if (selectedType === 'all') {
      return memories.slice(0, 30); // 限制显示数量
    }
    
    return getMemoriesByType(selectedType);
  };

  const displayMemories = getDisplayMemories();

  return (
    <Card className={`w-80 h-96 flex flex-col ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-shrink-0">
        <CardTitle className="text-sm font-medium">
          🧠 记忆库 ({memories.length})
        </CardTitle>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={generateReflection}
            disabled={isLoading || !agentId}
            title="生成反思记忆"
            className="h-6 w-6 p-0"
          >
            <Sparkles className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadMemories}
            disabled={isLoading}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-6 w-6 p-0"
          >
            <Minimize2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="flex-1 p-3 pt-0 min-h-0">
          {/* 搜索和筛选 */}
          <div className="space-y-2 mb-3">
            <div className="flex space-x-1">
              <Input
                placeholder="搜索记忆..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="text-xs h-7"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSearch}
                disabled={!searchQuery.trim() || isLoading}
                className="h-7 px-2"
              >
                <Search className="h-3 w-3" />
              </Button>
            </div>
            
            {/* 类型筛选 */}
            <div className="flex flex-wrap gap-1">
              {(['all', 'reflection', 'goal', 'emotion', 'thought', 'conversation', 'observation'] as const).map((type) => (
                <Button
                  key={type}
                  variant={selectedType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSelectedType(type);
                    setShowSearch(false);
                  }}
                  className="h-6 px-2 text-xs"
                >
                  {type === 'all' ? '全部' : getTypeName(type)}
                </Button>
              ))}
            </div>

            {showSearch && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  搜索结果: {searchResults.length} 条
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSearch(false)}
                  className="h-5 px-1 text-xs"
                >
                  返回
                </Button>
              </div>
            )}
          </div>

          {/* 记忆列表 */}
          <ScrollArea className="h-full w-full">
            <div className="space-y-2 pr-4">
              {error ? (
                <div className="text-center text-sm text-red-500 py-4">
                  {error}
                </div>
              ) : isLoading ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  加载中...
                </div>
              ) : displayMemories.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  {showSearch ? '没有找到相关记忆' : '暂无记忆'}
                </div>
              ) : (
                displayMemories.map((memory) => (
                  <div
                    key={memory.id}
                    className="border rounded-lg p-2 space-y-1 bg-muted/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant="secondary"
                          className={`${getTypeColor(memory.type)} text-xs`}
                        >
                          <span className="mr-1">{getTypeIcon(memory.type)}</span>
                          {getTypeName(memory.type)}
                        </Badge>
                        <div className="flex">
                          {getImportanceStars(memory.importance)}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        {'similarity' in memory && (
                          <span className="text-xs text-green-600">
                            {Math.round(memory.similarity * 100)}%
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatTime(memory.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-foreground leading-relaxed">
                      {memory.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}