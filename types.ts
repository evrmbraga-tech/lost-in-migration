
export enum Direction {
  UP = 'ArrowUp',
  DOWN = 'ArrowDown',
  LEFT = 'ArrowLeft',
  RIGHT = 'ArrowRight'
}

export type GameStatus = 'IDLE' | 'PLAYING' | 'GAMEOVER';

export interface FlockState {
  center: Direction;
  others: Direction;
}

export interface GameStats {
  score: number;
  correct: number;
  total: number;
  bestStreak: number;
  accuracy: number;
}

export interface RankingEntry {
  id: string;
  score: number;
  correct: number;
  accuracy: number;
  maxStreak: number;
  timestamp: number;
}
