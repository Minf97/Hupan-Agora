declare module 'pathfinding' {
  export class Grid {
    constructor(width: number, height: number, matrix?: number[][]);
    setWalkableAt(x: number, y: number, walkable: boolean): void;
    clone(): Grid;
  }
  
  export class AStarFinder {
    constructor(options: { allowDiagonal: boolean; dontCrossCorners: boolean });
    findPath(startX: number, startY: number, endX: number, endY: number, grid: Grid): number[][];
  }

  // 其他可能用到的类和接口
  export class BestFirstFinder extends AStarFinder {}
  export class BreadthFirstFinder {
    constructor(options?: { allowDiagonal: boolean; dontCrossCorners: boolean });
    findPath(startX: number, startY: number, endX: number, endY: number, grid: Grid): number[][];
  }
  export class DijkstraFinder extends AStarFinder {}
  export class BiAStarFinder extends AStarFinder {}
  export class JumpPointFinder {
    constructor(options?: { 
      allowDiagonal: boolean; 
      dontCrossCorners: boolean;
      heuristic?: (dx: number, dy: number) => number;
      trackJumpRecursion?: boolean;
    });
    findPath(startX: number, startY: number, endX: number, endY: number, grid: Grid): number[][];
  }
} 