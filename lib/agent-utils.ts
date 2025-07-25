// lib/agent-utils.ts
import { AgentState } from "@/lib/map-config";

// 计算两点间距离
export const calculateDistance = (
  pos1: { x: number; y: number },
  pos2: { x: number; y: number }
) => {
  return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
};

// 检查两个agent是否相遇（距离小于30像素）
export const checkAgentsMeeting = (agent1: AgentState, agent2: AgentState) => {
  return calculateDistance(agent1.position, agent2.position) < 30;
};

// 检查agent相遇
export const checkForMeetings = (currentAgents: AgentState[]) => {
  const meetings: { agent1: number; agent2: number }[] = [];

  for (let i = 0; i < currentAgents.length; i++) {
    for (let j = i + 1; j < currentAgents.length; j++) {
      const agent1 = currentAgents[i];
      const agent2 = currentAgents[j];

      // 如果两个agent都是空闲状态且相遇了
      if (
        agent1.status === "idle" &&
        agent2.status === "idle" &&
        checkAgentsMeeting(agent1, agent2)
      ) {
        meetings.push({ agent1: agent1.id, agent2: agent2.id });
      }
    }
  }

  return meetings;
};