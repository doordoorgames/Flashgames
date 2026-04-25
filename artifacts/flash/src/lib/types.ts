export type Difficulty = "Easy" | "Medium" | "Hard";

export interface GameItem {
  type: "text" | "image";
  prompt: string;
  mediaUrl?: string;
  correctAnswer: string;
  acceptedAnswers: string[];
  flashDurationMs: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  isAdmin: boolean;
}

export interface PlayerAnswer {
  playerId: string;
  playerName: string;
  answer: string;
  submittedAt: number;
  isCorrect?: boolean;
  pointsEarned?: number;
}

export type GamePhase =
  | "lobby"
  | "round-info"
  | "countdown"
  | "flash"
  | "answering"
  | "reveal"
  | "leaderboard"
  | "home"
  | "admin-setup";

export interface RoundReveal {
  item: GameItem;
  answers: PlayerAnswer[];
  leaderboard: Player[];
  isLastRound: boolean;
}
