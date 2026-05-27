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
  | "leaderboard";

export interface RoundResult {
  roundNumber: number;
  item: GameItem;
  answers: PlayerAnswer[];
}

export interface Room {
  code: string;
  adminId: string;
  players: Map<string, Player>;
  phase: GamePhase;
  currentRound: number;
  items: GameItem[];
  currentAnswers: Map<string, PlayerAnswer>;
  roundResults: RoundResult[];
  flashTimeout?: ReturnType<typeof setTimeout>;
  autoNextTimeout?: ReturnType<typeof setTimeout>;
}

export const ROUND_CONFIG: Array<{
  difficulty: Difficulty;
  flashDurationMs: number;
}> = [
  { difficulty: "Easy",   flashDurationMs: 900 },
  { difficulty: "Easy",   flashDurationMs: 900 },
  { difficulty: "Easy",   flashDurationMs: 900 },
  { difficulty: "Medium", flashDurationMs: 700 },
  { difficulty: "Medium", flashDurationMs: 700 },
  { difficulty: "Medium", flashDurationMs: 700 },
  { difficulty: "Hard",   flashDurationMs: 500 },
  { difficulty: "Hard",   flashDurationMs: 500 },
  { difficulty: "Hard",   flashDurationMs: 500 },
];

export const TOTAL_ROUNDS = 9;
export const ANSWER_TIME_LIMIT = 10;
