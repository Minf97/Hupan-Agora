export interface AgentState {
  id: string;
  position: { x: number; y: number };
  target: { x: number; y: number } | null;
  status: "idle" | "walking" | "talking" | "seeking";
  path?: Point[];
  walkStartTime?: number;
  walkDuration?: number;
}
