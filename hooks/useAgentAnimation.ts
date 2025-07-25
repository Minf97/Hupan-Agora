// hooks/useAgentAnimation.ts
import { useRef } from "react";
import Konva from "konva";
import PF from "pathfinding";
import { MAP_CONFIG, AgentState } from "@/lib/map-config";
import { calculateDistance, checkForMeetings } from "@/lib/agent-utils";

interface AnimationRefs {
  agentCirclesRef: React.MutableRefObject<{ [key: number]: Konva.Circle }>;
  agentTextsRef: React.MutableRefObject<{ [key: number]: Konva.Text }>;
}

interface AnimationCallbacks {
  onAgentUpdate: (updater: (prev: AgentState[]) => AgentState[]) => void;
  onTaskComplete: (agentId: number, status: AgentState["status"], position: { x: number; y: number }) => void;
  getCurrentAgents: () => AgentState[];
}

export const useAgentAnimation = (refs: AnimationRefs, callbacks: AnimationCallbacks) => {
  const animationsRef = useRef<{ [key: number]: Konva.Animation }>({});
  const gridRef = useRef(createGrid());

  function createGrid() {
    const gridWidth = Math.ceil(MAP_CONFIG.width / MAP_CONFIG.gridSize);
    const gridHeight = Math.ceil(MAP_CONFIG.height / MAP_CONFIG.gridSize);
    const grid = new PF.Grid(gridWidth, gridHeight);

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

        // 检查移动中的相遇
        const currentMovingAgentPosition = { x: newX, y: newY };
        const currentAgents = callbacks.getCurrentAgents();
        const otherIdleAgents = currentAgents.filter(a => a.id !== agentId);

        for (const idleAgent of otherIdleAgents) {
          const idleAgentCircle = agentCirclesRef.current[idleAgent.id];
          if (idleAgentCircle) {
            const idleAgentPosition = { x: idleAgentCircle.x(), y: idleAgentCircle.y() };
            const distance = calculateDistance(currentMovingAgentPosition, idleAgentPosition);

            if (distance < 30) {
              console.log(`移动中: Agent ${agentId} 和 Agent ${idleAgent.id} 相遇了！`);

              // 停止动画
              animation.stop();
              delete animationsRef.current[agentId];

              // 更新状态
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

                console.log(`中途相遇: Agent ${agentId} 和 Agent ${idleAgent.id} 相遇了！`);
                return updatedAgents;
              });

              callbacks.onTaskComplete(agentId, "idle", { x: newX, y: newY });
              return;
            }
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

              // 检查新的相遇
              const meetings = checkForMeetings(updatedAgents);
              meetings.forEach((meeting) => {
                console.log(`Agent ${meeting.agent1} 和 Agent ${meeting.agent2} 相遇了！`);
              });

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
  };
};