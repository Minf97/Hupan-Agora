// components/ThoughtPanel.tsx - 显示内心思考和对话的面板

"use client";

import { useState } from 'react';
import { ThoughtRecord } from '@/hooks/useThoughtLogger';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, MessageCircle, Target, X, Minimize2, RefreshCw } from 'lucide-react';

interface ThoughtPanelProps {
  thoughts: ThoughtRecord[];
  onClear: () => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function ThoughtPanel({ thoughts, onClear, isLoading = false, onRefresh }: ThoughtPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const getTypeIcon = (type: ThoughtRecord['type']) => {
    switch (type) {
      case 'inner_thought':
        return <Brain className="h-3 w-3" />;
      case 'decision':
        return <Target className="h-3 w-3" />;
      case 'conversation':
        return <MessageCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: ThoughtRecord['type']) => {
    switch (type) {
      case 'inner_thought':
        return 'bg-purple-100 text-purple-800';
      case 'decision':
        return 'bg-blue-100 text-blue-800';
      case 'conversation':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeName = (type: ThoughtRecord['type']) => {
    switch (type) {
      case 'inner_thought':
        return '内心独白';
      case 'decision':
        return '决策';
      case 'conversation':
        return '对话';
      default:
        return '未知';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const recentThoughts = thoughts.slice(-50).reverse(); // 显示最新50条，倒序

  return (
    <Card className="w-80 h-96 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-shrink-0">
        <CardTitle className="text-sm font-medium">
          💭 思考记录 ({thoughts.length})
        </CardTitle>
        <div className="flex items-center space-x-1">
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
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
            onClick={onClear}
            className="h-6 w-6 p-0"
          >
            清空
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
          <ScrollArea className="h-full w-full">
            <div className="space-y-2 pr-4">
              {isLoading ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  加载中...
                </div>
              ) : recentThoughts.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  暂无思考记录
                </div>
              ) : (
                recentThoughts.map((thought) => (
                  <div
                    key={thought.id}
                    className="border rounded-lg p-2 space-y-1 bg-muted/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant="secondary"
                          className={`${getTypeColor(thought.type)} text-xs`}
                        >
                          <span className="mr-1">{getTypeIcon(thought.type)}</span>
                          {getTypeName(thought.type)}
                        </Badge>
                        <span className="text-xs font-medium text-foreground">
                          {thought.agentName}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(thought.timestamp)}
                      </span>
                    </div>

                    <div className="text-xs text-foreground leading-relaxed">
                      {thought.content}
                    </div>

                    {thought.metadata && (
                      <div className="space-y-1">
                        {thought.metadata.confidence !== undefined && (
                          <div className="text-xs text-muted-foreground">
                            确信度: {Math.round(thought.metadata.confidence * 100)}%
                          </div>
                        )}
                        {thought.metadata.reasoning && (
                          <div className="text-xs text-muted-foreground">
                            原因: {thought.metadata.reasoning}
                          </div>
                        )}
                        {thought.metadata.emotion && (
                          <div className="text-xs text-muted-foreground">
                            情绪: {thought.metadata.emotion}
                          </div>
                        )}
                      </div>
                    )}
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