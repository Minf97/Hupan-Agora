// lib/activity-logs.ts - 活动日志服务

export interface ActivityLogEntry {
  type: 'conversation_start' | 'conversation_end' | 'conversation_message' | 'status_change' | 'location_change' | 'memory_created' | 'memory_accessed';
  agentId: number;
  agentName: string;
  content: string;
  targetAgentId?: number;
  targetAgentName?: string;
  conversationId?: number;
  memoryId?: number;
  metadata?: any;
}

export interface ActivityLogWithId extends ActivityLogEntry {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

class ActivityLogService {
  private baseUrl = '/api/activity-logs';

  // 创建新的活动日志
  async createLog(entry: ActivityLogEntry): Promise<ActivityLogWithId> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('创建活动日志失败:', error);
      throw error;
    }
  }

  // 获取活动日志
  async getLogs(options: {
    agentId?: number;
    type?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ActivityLogWithId[]> {
    try {
      const params = new URLSearchParams();
      
      if (options.agentId) {
        params.set('agentId', options.agentId.toString());
      }
      if (options.type) {
        params.set('type', options.type);
      }
      if (options.limit) {
        params.set('limit', options.limit.toString());
      }
      if (options.offset) {
        params.set('offset', options.offset.toString());
      }

      const url = params.toString() ? `${this.baseUrl}?${params}` : this.baseUrl;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const results = await response.json();
      return results.map((log: any) => ({
        ...log,
        createdAt: new Date(log.createdAt),
        updatedAt: new Date(log.updatedAt),
      }));
    } catch (error) {
      console.error('获取活动日志失败:', error);
      throw error;
    }
  }

  // 创建对话开始日志
  async logConversationStart(
    agentId: number,
    agentName: string,
    targetAgentId: number,
    targetAgentName: string,
    conversationId?: number
  ): Promise<ActivityLogWithId> {
    return this.createLog({
      type: 'conversation_start',
      agentId,
      agentName,
      content: `${agentName} 开始与 ${targetAgentName} 交谈`,
      targetAgentId,
      targetAgentName,
      conversationId,
    });
  }

  // 创建对话结束日志
  async logConversationEnd(
    agentId: number,
    agentName: string,
    targetAgentId: number,
    targetAgentName: string,
    conversationId?: number
  ): Promise<ActivityLogWithId> {
    return this.createLog({
      type: 'conversation_end',
      agentId,
      agentName,
      content: `${agentName} 结束与 ${targetAgentName} 的交谈`,
      targetAgentId,
      targetAgentName,
      conversationId,
    });
  }

  // 创建状态变化日志
  async logStatusChange(
    agentId: number,
    agentName: string,
    fromStatus: string,
    toStatus: string
  ): Promise<ActivityLogWithId> {
    return this.createLog({
      type: 'status_change',
      agentId,
      agentName,
      content: `${agentName} 状态从 ${fromStatus} 变为 ${toStatus}`,
      metadata: {
        fromStatus,
        toStatus,
      },
    });
  }
}

export const activityLogService = new ActivityLogService();