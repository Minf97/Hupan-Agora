import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 内心OS (反思)
export function innerOS(agentId: number) {
  // TODO: 这里数字人要思考，要不要跟对方说话，或者要不要打招呼
  // TODO: 要根据对方的 bg
  // TODO: 我思考的方式是，将双方的 bg 都丢给 AI 然后 AI 来决定要不要打招呼
  return `Agent ${agentId} 的内心OS`;
}


// 对话，开启聊天
export function startConversation(agent1: number, agent2: number) {
  return `Agent ${agent1} 和 Agent ${agent2} 开始对话`;
}


