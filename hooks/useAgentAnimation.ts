// hooks/useAgentAnimation.ts
import { useRef } from "react";
import Konva from "konva";
import PF from "pathfinding";
import { MAP_CONFIG, AgentState, Wall, Door } from "@/lib/map-config";
import { calculateDistance, checkForMeetings, processAgentEncounter, MEETING_DISTANCE_THRESHOLD, getAgentStatusSummary } from "@/lib/agent-utils";
import { getConversationManager } from "@/lib/conversation-manager";
import { getAgentPersonalityFromDB } from "@/lib/agent-database";

interface AnimationRefs {
  agentCirclesRef: React.MutableRefObject<{ [key: number]: Konva.Circle }>;
  agentTextsRef: React.MutableRefObject<{ [key: number]: Konva.Text }>;
}

interface AnimationCallbacks {
  onAgentUpdate: (updater: (prev: AgentState[]) => AgentState[]) => void;
  onTaskComplete: (agentId: number, status: AgentState["status"], position: { x: number; y: number }) => void;
  getCurrentAgents: () => AgentState[];
  onAgentEncounter?: (agent1Id: number, agent2Id: number, location: string) => void;
  onThoughtLog?: {
    addInnerThought: (agentId: number, agentName: string, thought: string, metadata?: any) => void;
    addDecision: (agentId: number, agentName: string, decision: string, metadata?: any) => void;
    addConversation: (agentId: number, agentName: string, message: string, metadata?: any) => void;
  };
  onRealtimeLog?: (entry: {
    type: 'conversation' | 'inner_thought' | 'decision';
    agentName: string;
    content: string;
    emotion?: string;
  }) => void;
}

export const useAgentAnimation = (refs: AnimationRefs, callbacks: AnimationCallbacks) => {
  const animationsRef = useRef<{ [key: number]: Konva.Animation }>({});
  const gridRef = useRef(createGrid());
  
  // 停止指定agent的动画
  const stopAgentAnimation = (agentId: number, updateToIdle: boolean = true) => {
    if (animationsRef.current[agentId]) {
      console.log(`⏹️ 停止 Agent ${agentId} 的动画 ${updateToIdle ? '(设为idle)' : '(保持当前状态)'}`);
      
      // 获取当前动画位置并同步到agent状态
      const agentCircle = refs.agentCirclesRef.current[agentId];
      const currentPosition = agentCircle ? 
        { x: agentCircle.x(), y: agentCircle.y() } : 
        null;
      
      // 停止动画
      animationsRef.current[agentId].stop();
      delete animationsRef.current[agentId];
      
      // 只有在指定时才更新agent状态为idle
      if (updateToIdle) {
        callbacks.onAgentUpdate((prev) =>
          prev.map((agent) =>
            agent.id === agentId
              ? {
                  ...agent,
                  position: currentPosition || agent.position, // 使用当前动画位置
                  status: "idle" as const,
                  target: null,
                  walkStartTime: undefined,
                  walkDuration: undefined,
                }
              : agent
          )
        );
      } else {
        // 仅清除移动相关属性，但保持当前状态
        callbacks.onAgentUpdate((prev) =>
          prev.map((agent) =>
            agent.id === agentId
              ? {
                  ...agent,
                  position: currentPosition || agent.position, // 使用当前动画位置
                  target: null,
                  walkStartTime: undefined,
                  walkDuration: undefined,
                }
              : agent
          )
        );
      }
    }
  };
  
  // 相遇状态管理
  const encounterCooldowns = useRef<{ [key: string]: number }>({});
  const activeConversations = useRef<Set<number>>(new Set());
  const ENCOUNTER_COOLDOWN = 30000; // 30秒冷却时间
  const ENCOUNTER_DISTANCE = MEETING_DISTANCE_THRESHOLD; // 相遇距离（使用统一常量）
  
  // 生成相遇键（确保顺序一致）
  const getEncounterKey = (agent1Id: number, agent2Id: number): string => {
    return agent1Id < agent2Id ? `${agent1Id}-${agent2Id}` : `${agent2Id}-${agent1Id}`;
  };
  
  // 检查是否可以相遇
  const canEncounter = (agent1Id: number, agent2Id: number): boolean => {
    // 检查是否在冷却时间内
    const encounterKey = getEncounterKey(agent1Id, agent2Id);
    const lastEncounter = encounterCooldowns.current[encounterKey];
    const now = Date.now();
    
    if (lastEncounter && (now - lastEncounter) < ENCOUNTER_COOLDOWN) {
      console.log(`⏱️ 相遇冷却中: Agent ${agent1Id} ↔ Agent ${agent2Id}, 剩余 ${Math.round((ENCOUNTER_COOLDOWN - (now - lastEncounter)) / 1000)}秒`);
      return false;
    }
    
    // 检查是否已经在对话中
    if (activeConversations.current.has(agent1Id) || activeConversations.current.has(agent2Id)) {
      console.log(`💬 无法相遇: Agent ${agent1Id} 或 Agent ${agent2Id} 正在对话中`);
      return false;
    }
    
    return true;
  };
  
  // 记录相遇
  const recordEncounter = (agent1Id: number, agent2Id: number): void => {
    const encounterKey = getEncounterKey(agent1Id, agent2Id);
    encounterCooldowns.current[encounterKey] = Date.now();
    
    // 标记为正在对话
    activeConversations.current.add(agent1Id);
    activeConversations.current.add(agent2Id);
    
    console.log(`📅 记录相遇: Agent ${agent1Id} ↔ Agent ${agent2Id}, 冷却时间: ${ENCOUNTER_COOLDOWN / 1000}秒`);
  };
  
  // 清除对话状态
  const clearConversationState = (agent1Id: number, agent2Id: number): void => {
    activeConversations.current.delete(agent1Id);
    activeConversations.current.delete(agent2Id);
    console.log(`🧹 清除对话状态: Agent ${agent1Id} 和 Agent ${agent2Id}`);
  };

  // 处理Agent相遇事件
  const handleAgentEncounter = async (agent1Id: number, agent2Id: number, location: string) => {
    try {
      const conversationManager = getConversationManager();
      
      // 检查是否已经在对话中
      if (conversationManager.isAgentInConversation(agent1Id) || 
          conversationManager.isAgentInConversation(agent2Id)) {
        console.log(`Agent ${agent1Id} 或 Agent ${agent2Id} 已经在对话中`);
        return;
      }

      // 获取当前时间
      const now = new Date();
      const encounterResult = await processAgentEncounter(agent1Id, agent2Id, {
        location,
        timeOfDay: now.getHours(),
        townTime: { hour: now.getHours(), minute: now.getMinutes() }
      });

      // Get agent personalities for logging
      const agent1Personality = await getAgentPersonalityFromDB(agent1Id);
      const agent2Personality = await getAgentPersonalityFromDB(agent2Id);

      // 记录内心思考
      if (callbacks.onThoughtLog) {
        const agent1Name = agent1Personality.name;
        const agent2Name = agent2Personality.name;
        
        callbacks.onThoughtLog.addInnerThought(
          agent1Id,
          agent1Name,
          encounterResult.agent1Thoughts.internal_monologue,
          {
            confidence: encounterResult.agent1Thoughts.confidence,
            reasoning: encounterResult.agent1Thoughts.reasoning,
            shouldInitiateChat: encounterResult.agent1Thoughts.shouldInitiateChat
          }
        );
        
        callbacks.onThoughtLog.addInnerThought(
          agent2Id,
          agent2Name,
          encounterResult.agent2Thoughts.internal_monologue,
          {
            confidence: encounterResult.agent2Thoughts.confidence,
            reasoning: encounterResult.agent2Thoughts.reasoning,
            shouldInitiateChat: encounterResult.agent2Thoughts.shouldInitiateChat
          }
        );
      }

      // 如果双方都有意愿对话，或者一方非常主动
      const shouldStartConversation = 
        (encounterResult.agent1WantsToChat && encounterResult.agent2WantsToChat) ||
        (encounterResult.agent1WantsToChat && encounterResult.agent1Thoughts.confidence > 0.8) ||
        (encounterResult.agent2WantsToChat && encounterResult.agent2Thoughts.confidence > 0.8);

      if (shouldStartConversation) {
        console.log(`开始对话: Agent ${agent1Id} 和 Agent ${agent2Id}`);
        
        // 记录决策
        if (callbacks.onThoughtLog) {
          // We already have the personalities from above
          const agent1Name = agent1Personality.name;
          const agent2Name = agent2Personality.name;
          
          if (encounterResult.agent1WantsToChat) {
            callbacks.onThoughtLog.addDecision(
              agent1Id,
              agent1Name,
              `决定与${agent2Name}开始对话`,
              { confidence: encounterResult.agent1Thoughts.confidence }
            );
          }
          
          if (encounterResult.agent2WantsToChat) {
            callbacks.onThoughtLog.addDecision(
              agent2Id,
              agent2Name,
              `决定与${agent1Name}开始对话`,
              { confidence: encounterResult.agent2Thoughts.confidence }
            );
          }
        }
        
        // 创建对话
        const conversation = await conversationManager.startConversation({
          participants: [agent1Id, agent2Id],
          location,
          initiator: encounterResult.agent1WantsToChat ? agent1Id : agent2Id
        });

        // 更新Agent状态为“talking”
        callbacks.onAgentUpdate((prev) =>
          prev.map((agent) =>
            agent.id === agent1Id || agent.id === agent2Id
              ? { ...agent, status: "talking" as const }
              : agent
          )
        );

        // 开始对话循环
        startConversationLoop(conversation.id);
      } else {
        console.log(`Agent ${agent1Id} 和 Agent ${agent2Id} 选择不开始对话`);
      }
    } catch (error) {
      console.error('处理Agent相遇失败:', error);
    }
  };

  // 对话循环
  const startConversationLoop = async (conversationId: string) => {
    const conversationManager = getConversationManager();
    
    const continueConversation = async () => {
      const message = await conversationManager.continueConversation(conversationId);
      
      if (message) {
        console.log(`${message.speaker}: ${message.content}`);
        
        // 添加到实时日志
        if (callbacks.onRealtimeLog) {
          callbacks.onRealtimeLog({
            type: 'conversation',
            agentName: message.speaker,
            content: message.content,
            emotion: message.emotion
          });
        }
        
        // 不再记录每条对话消息，只在对话结束时创建总结记忆
        
        // 继续对话（在一定延迟后）
        setTimeout(continueConversation, 2000 + Math.random() * 3000); // 2-5秒随机延迟
      } else {
        // 对话结束，更新Agent状态
        const conversation = conversationManager.getConversation(conversationId);
        if (conversation) {
          callbacks.onAgentUpdate((prev) =>
            prev.map((agent) =>
              conversation.participants.includes(agent.id)
                ? { ...agent, status: "idle" as const }
                : agent
            )
          );
        }
      }
    };

    // 开始第一轮对话
    setTimeout(continueConversation, 1000);
  };

  function createGrid() {
    const gridWidth = Math.ceil(MAP_CONFIG.width / MAP_CONFIG.gridSize);
    const gridHeight = Math.ceil(MAP_CONFIG.height / MAP_CONFIG.gridSize);
    const grid = new PF.Grid(gridWidth, gridHeight);

    // Mark wall areas as non-walkable
    MAP_CONFIG.walls.forEach((wall: Wall) => {
      const startX = Math.floor(wall.x / MAP_CONFIG.gridSize);
      const startY = Math.floor(wall.y / MAP_CONFIG.gridSize);
      const endX = Math.ceil((wall.x + wall.width) / MAP_CONFIG.gridSize);
      const endY = Math.ceil((wall.y + wall.height) / MAP_CONFIG.gridSize);

      for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
          if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
            grid.setWalkableAt(x, y, false);
          }
        }
      }
    });

    // Mark door areas as walkable (doors allow passage)
    MAP_CONFIG.doors.forEach((door: Door) => {
      if (door.isOpen) {
        const startX = Math.floor(door.x / MAP_CONFIG.gridSize);
        const startY = Math.floor(door.y / MAP_CONFIG.gridSize);
        const endX = Math.ceil((door.x + door.width) / MAP_CONFIG.gridSize);
        const endY = Math.ceil((door.y + door.height) / MAP_CONFIG.gridSize);

        for (let x = startX; x < endX; x++) {
          for (let y = startY; y < endY; y++) {
            if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
              grid.setWalkableAt(x, y, true);
            }
          }
        }
      }
    });

    // Handle legacy obstacles for backward compatibility
    MAP_CONFIG.obstacles.forEach(
      (obstacle: { x: number; y: number; width: number; height: number }) => {
        const startX = Math.floor(obstacle.x / MAP_CONFIG.gridSize);
        const startY = Math.floor(obstacle.y / MAP_CONFIG.gridSize);
        const endX = Math.ceil((obstacle.x + obstacle.width) / MAP_CONFIG.gridSize);
        const endY = Math.ceil((obstacle.y + obstacle.height) / MAP_CONFIG.gridSize);

        for (let x = startX; x < endX; x++) {
          for (let y = startY; y < endY; y++) {
            if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
              grid.setWalkableAt(x, y, false);
            }
          }
        }
      }
    );

    return grid;
  }

  const gridToPixel = (x: number, y: number) => ({
    x: (x + 0.5) * MAP_CONFIG.gridSize,
    y: (y + 0.5) * MAP_CONFIG.gridSize,
  });

  const pixelToGrid = (x: number, y: number) => ({
    x: Math.floor(x / MAP_CONFIG.gridSize),
    y: Math.floor(y / MAP_CONFIG.gridSize),
  });

  const animateAgentMovement = (
    agentId: number,
    targetPosition: { x: number; y: number }
  ) => {
    const { agentCirclesRef, agentTextsRef } = refs;
    const agentCircle = agentCirclesRef.current[agentId];
    const agentText = agentTextsRef.current[agentId];

    if (!agentCircle || !agentText) return;

    // 停止现有动画
    if (animationsRef.current[agentId]) {
      animationsRef.current[agentId].stop();
    }

    // 同步Circle位置到当前agent位置（防止socket移动后位置不同步）
    const currentAgents = callbacks.getCurrentAgents();
    const currentAgent = currentAgents.find(a => a.id === agentId);
    if (currentAgent) {
      agentCircle.x(currentAgent.position.x);
      agentCircle.y(currentAgent.position.y);
      agentText.x(currentAgent.position.x - 35);
      agentText.y(currentAgent.position.y - 45);
    }

    const currentX = agentCircle.x();
    const currentY = agentCircle.y();

    // A* 寻路
    const startGrid = pixelToGrid(currentX, currentY);
    const endGrid = pixelToGrid(targetPosition.x, targetPosition.y);

    const finder = new PF.AStarFinder({
      allowDiagonal: true,
      dontCrossCorners: false,
    });

    const gridClone = gridRef.current.clone();
    const path = finder.findPath(
      startGrid.x,
      startGrid.y,
      endGrid.x,
      endGrid.y,
      gridClone
    );

    if (path.length === 0) {
      console.error(`无法为Agent ${agentId} 找到到达目标的路径`);
      return;
    }

    const pixelPath = path.map(([x, y]) => gridToPixel(x, y));

    // 计算路径总长度
    let totalDistance = 0;
    for (let i = 1; i < pixelPath.length; i++) {
      const dx = pixelPath[i].x - pixelPath[i - 1].x;
      const dy = pixelPath[i].y - pixelPath[i - 1].y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);
    }

    const moveSpeed = 50;
    const duration = (totalDistance / moveSpeed) * 1000;

    // 更新agent状态为walking
    callbacks.onAgentUpdate((prev) =>
      prev.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              status: "walking" as const,
              walkStartTime: Date.now(),
              walkDuration: duration,
            }
          : agent
      )
    );

    // 动画变量
    let currentPathIndex = 1;
    let segmentStartTime = 0;
    let segmentProgress = 0;
    let currentSegmentStartX = currentX;
    let currentSegmentStartY = currentY;
    let currentSegmentEndX = pixelPath[currentPathIndex].x;
    let currentSegmentEndY = pixelPath[currentPathIndex].y;
    let currentSegmentDistance = Math.sqrt(
      Math.pow(currentSegmentEndX - currentSegmentStartX, 2) +
        Math.pow(currentSegmentEndY - currentSegmentStartY, 2)
    );

    const animation = new Konva.Animation((frame) => {
      if (!frame) return;

      const elapsedTime = frame.time - segmentStartTime;

      if (segmentProgress < 1) {
        segmentProgress = Math.min(
          elapsedTime / ((currentSegmentDistance / totalDistance) * duration),
          1
        );

        const newX =
          currentSegmentStartX +
          (currentSegmentEndX - currentSegmentStartX) * segmentProgress;
        const newY =
          currentSegmentStartY +
          (currentSegmentEndY - currentSegmentStartY) * segmentProgress;

        // 更新位置
        agentCircle.x(newX);
        agentCircle.y(newY);
        agentText.x(newX - 15);
        agentText.y(newY - 25);

        // 检查移动中的相遇（优化：只有空闲状态的agent才能相遇）
        const currentMovingAgentPosition = { x: newX, y: newY };
        const currentAgents = callbacks.getCurrentAgents();
        const otherIdleAgents = currentAgents.filter(a => 
          a.id !== agentId && 
          a.status === "idle" && 
          !activeConversations.current.has(a.id) // 确保目标agent不在对话中
        );

        for (const idleAgent of otherIdleAgents) {
          try {
            const idleAgentCircle = agentCirclesRef.current[idleAgent.id];
            if (!idleAgentCircle) {
              console.warn(`无法找到Agent ${idleAgent.id}的UI对象`);
              continue;
            }

            const idleAgentPosition = { x: idleAgentCircle.x(), y: idleAgentCircle.y() };
            const distance = calculateDistance(currentMovingAgentPosition, idleAgentPosition);

            // 验证距离计算结果
            if (distance === Infinity || isNaN(distance)) {
              console.warn(`Agent ${agentId} 和 Agent ${idleAgent.id} 之间距离计算无效: ${distance}`);
              continue;
            }

            if (distance < ENCOUNTER_DISTANCE) {
              // 检查是否可以相遇（冷却时间、对话状态等）
              if (!canEncounter(agentId, idleAgent.id)) {
                continue; // 跳过这个agent，检查下一个
              }

              console.log(`✨ 移动中相遇: ${getAgentStatusSummary(currentAgents.find(a => a.id === agentId) || {} as AgentState)} 与 ${getAgentStatusSummary(idleAgent)} 相遇！距离: ${Math.round(distance)}px`);

              // 记录相遇，防止重复
              recordEncounter(agentId, idleAgent.id);

              // 立即停止动画
              animation.stop();
              delete animationsRef.current[agentId];

              // 获取当前所在房间
              const currentRoom = MAP_CONFIG.rooms.find(room =>
                newX >= room.x && newX <= room.x + room.width &&
                newY >= room.y && newY <= room.y + room.height
              );
              const locationName = currentRoom ? currentRoom.name : "街道";

              // 更新移动agent状态为idle
              callbacks.onAgentUpdate((prev) => {
                const updatedAgents = prev.map((agent) =>
                  agent.id === agentId
                    ? {
                        ...agent,
                        position: { x: newX, y: newY },
                        status: "idle" as const,
                        target: null,
                        walkStartTime: undefined,
                        walkDuration: undefined,
                      }
                    : agent
                );

                return updatedAgents;
              });

              // 通知任务完成
              callbacks.onTaskComplete(agentId, "idle", { x: newX, y: newY });

              // 触发相遇事件，可能开始对话
              handleAgentEncounter(agentId, idleAgent.id, locationName);

              return;
            }
          } catch (error) {
            console.error(`处理Agent ${agentId}与Agent ${idleAgent.id}相遇检测时出错:`, error);
            continue;
          }
        }

        // 检查路径段完成
        if (segmentProgress >= 1) {
          if (currentPathIndex < pixelPath.length - 1) {
            // 下一个路径段
            currentPathIndex++;
            segmentStartTime = frame.time;
            segmentProgress = 0;
            currentSegmentStartX = currentSegmentEndX;
            currentSegmentStartY = currentSegmentEndY;
            currentSegmentEndX = pixelPath[currentPathIndex].x;
            currentSegmentEndY = pixelPath[currentPathIndex].y;
            currentSegmentDistance = Math.sqrt(
              Math.pow(currentSegmentEndX - currentSegmentStartX, 2) +
                Math.pow(currentSegmentEndY - currentSegmentStartY, 2)
            );
          } else {
            // 路径完成
            animation.stop();
            delete animationsRef.current[agentId];

            callbacks.onAgentUpdate((prev) => {
              const updatedAgents = prev.map((agent) =>
                agent.id === agentId
                  ? {
                      ...agent,
                      position: targetPosition,
                      status: "idle" as const,
                      target: null,
                      walkStartTime: undefined,
                      walkDuration: undefined,
                    }
                  : agent
              );

              // 检查新的相遇（到达目标点时）
              try {
                const meetings = checkForMeetings(updatedAgents);
                if (meetings.length > 0) {
                  console.log(`🎯 到达目标点检测到 ${meetings.length} 个相遇`);
                }
                
                meetings.forEach((meeting) => {
                  try {
                    // 检查是否可以相遇（避免重复相遇）
                    if (canEncounter(meeting.agent1, meeting.agent2)) {
                      const agent1 = updatedAgents.find(a => a.id === meeting.agent1);
                      const agent2 = updatedAgents.find(a => a.id === meeting.agent2);
                      
                      if (agent1 && agent2) {
                        console.log(`🎯 到达目标点相遇: ${getAgentStatusSummary(agent1)} 与 ${getAgentStatusSummary(agent2)} 相遇了！`);
                        
                        // 获取相遇所在房间
                        const meetingRoom = MAP_CONFIG.rooms.find(room =>
                          targetPosition.x >= room.x && targetPosition.x <= room.x + room.width &&
                          targetPosition.y >= room.y && targetPosition.y <= room.y + room.height
                        );
                        const meetingLocation = meetingRoom ? meetingRoom.name : "街道";
                        
                        // 记录相遇
                        recordEncounter(meeting.agent1, meeting.agent2);
                        // 触发相遇事件，可能开始对话
                        handleAgentEncounter(meeting.agent1, meeting.agent2, meetingLocation);
                      } else {
                        console.warn(`相遇检测中找不到Agent: ${meeting.agent1} 或 ${meeting.agent2}`);
                      }
                    }
                  } catch (error) {
                    console.error(`处理到达目标点相遇时出错:`, error, meeting);
                  }
                });
              } catch (error) {
                console.error(`检测到达目标点相遇时出错:`, error);
              }

              return updatedAgents;
            });

            callbacks.onTaskComplete(agentId, "idle", targetPosition);
          }
        }
      }
    }, agentCircle.getLayer());

    animationsRef.current[agentId] = animation;
    animation.start();
  };

  return {
    animateAgentMovement,
    animationsRef,
    stopAgentAnimation,
    // 暴露对话状态管理方法
    clearConversationState,
    getActiveConversations: () => Array.from(activeConversations.current),
    getEncounterCooldowns: () => ({ ...encounterCooldowns.current }),
  };
};