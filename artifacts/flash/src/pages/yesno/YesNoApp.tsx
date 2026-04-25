import { useState, useEffect } from "react";
import { getSocket } from "@/lib/socket";
import YesNoHome from "./YesNoHome";
import YesNoLobby from "./YesNoLobby";
import YesNoGame from "./YesNoGame";

export type YNPhase = "home" | "create" | "join" | "lobby" | "game";

export interface YNPlayer {
  id: string;
  name: string;
  score: number;
  isAdmin: boolean;
}

export interface YNSession {
  code: string;
  playerId: string;
  playerName: string;
  isAdmin: boolean;
}

interface YNLobbyState {
  players: YNPlayer[];
  adminId: string;
  questionCount: number;
}

interface YNRoundState {
  hotSeatPlayerId: string;
  hotSeatPlayerName: string;
  question: string;
  questionNumber: number;
  leaderboard: YNPlayer[];
  playerNumber: number;
  totalPlayers: number;
  isLastPlayer: boolean;
  nextPlayerName: string | null;
}

interface Props {
  onBack: () => void;
}

export default function YesNoApp({ onBack }: Props) {
  const [phase, setPhase] = useState<YNPhase>("home");
  const [session, setSession] = useState<YNSession | null>(null);
  const [lobbyState, setLobbyState] = useState<YNLobbyState>({ players: [], adminId: "", questionCount: 0 });
  const [gamePhase, setGamePhase] = useState<"round" | "between-rounds" | "gameover">("round");
  const [roundState, setRoundState] = useState<YNRoundState | null>(null);
  const [answersThisRound, setAnswersThisRound] = useState<string[]>([]);
  const [lastViolation, setLastViolation] = useState<{ type: string; answer: string } | null>(null);
  const [roundResult, setRoundResult] = useState<{ passed: boolean; answersGiven: number; violation: string; isLastPlayer: boolean; nextPlayerName: string | null } | null>(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState<YNPlayer[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const socket = getSocket();

    socket.on("yn:lobby-update", (data: YNLobbyState) => {
      setLobbyState(data);
      if (phase !== "lobby" && phase !== "home" && phase !== "create" && phase !== "join") {
        setPhase("lobby");
      }
    });

    socket.on("yn:round-started", (data: YNRoundState) => {
      setRoundState(data);
      setCurrentQuestion(data.question);
      setCurrentQuestionNumber(data.questionNumber);
      setAnswersThisRound([]);
      setLastViolation(null);
      setRoundResult(null);
      setGamePhase("round");
      setPhase("game");
    });

    socket.on("yn:question-changed", (data: { question: string; questionNumber: number }) => {
      setCurrentQuestion(data.question);
      setCurrentQuestionNumber(data.questionNumber);
    });

    socket.on("yn:answer-result", (data: { answer: string; violation: string | null; answersThisRound: string[]; questionNumber: number }) => {
      setAnswersThisRound(data.answersThisRound);
      if (data.violation) {
        setLastViolation({ type: data.violation, answer: data.answer });
      }
    });

    socket.on("yn:round-over", (data: { passed: boolean; violation: string; answersGiven: number; hotSeatPlayerId: string; leaderboard: YNPlayer[]; isLastPlayer: boolean; nextPlayerName: string | null }) => {
      setRoundResult({ passed: data.passed, answersGiven: data.answersGiven, violation: data.violation, isLastPlayer: data.isLastPlayer, nextPlayerName: data.nextPlayerName });
      setGamePhase("between-rounds");
      setLobbyState(prev => ({ ...prev, players: data.leaderboard }));
    });

    socket.on("yn:game-over", (data: { leaderboard: YNPlayer[] }) => {
      setFinalLeaderboard(data.leaderboard);
      setGamePhase("gameover");
      setPhase("game");
    });

    socket.on("yn:error", (data: { message: string }) => {
      setErrorMsg(data.message);
    });

    socket.on("yn:room-closed", () => {
      alert("Host left. Room closed.");
      setPhase("home");
      setSession(null);
    });

    return () => {
      ["yn:lobby-update","yn:round-started","yn:question-changed",
       "yn:answer-result","yn:round-over","yn:game-over","yn:error","yn:room-closed"]
        .forEach(e => socket.off(e));
    };
  }, [phase]);

  const handleJoined = (code: string, playerId: string, name: string, isAdmin: boolean) => {
    setSession({ code, playerId, playerName: name, isAdmin });
    setPhase("lobby");
  };

  const startGame = () => {
    if (!session) return;
    getSocket().emit("yn:start-round", { code: session.code });
  };

  const nextPlayer = () => {
    if (!session) return;
    getSocket().emit("yn:next-player", { code: session.code });
  };

  const submitAnswer = (answer: string) => {
    if (!session) return;
    getSocket().emit("yn:submit-answer", { code: session.code, answer });
  };

  const nextQuestion = () => {
    if (!session) return;
    getSocket().emit("yn:next-question", { code: session.code });
  };

  const failPlayer = () => {
    if (!session) return;
    getSocket().emit("yn:fail-player", { code: session.code });
  };

  const endGame = () => {
    if (!session) return;
    getSocket().emit("yn:end-game", { code: session.code });
  };

  const returnToLobby = () => {
    if (!session) return;
    getSocket().emit("yn:return-lobby", { code: session.code });
    setGamePhase("round");
  };

  if (phase === "game" && session) {
    return (
      <YesNoGame
        session={session}
        gamePhase={gamePhase}
        roundState={roundState}
        currentQuestion={currentQuestion}
        currentQuestionNumber={currentQuestionNumber}
        answersThisRound={answersThisRound}
        lastViolation={lastViolation}
        roundResult={roundResult}
        finalLeaderboard={finalLeaderboard}
        lobbyPlayers={lobbyState.players}
        onSubmitAnswer={submitAnswer}
        onNextQuestion={nextQuestion}
        onFailPlayer={failPlayer}
        onEndGame={endGame}
        onReturnToLobby={returnToLobby}
        onNextPlayer={nextPlayer}
      />
    );
  }

  if ((phase === "lobby") && session) {
    return (
      <YesNoLobby
        session={session}
        lobbyState={lobbyState}
        errorMsg={errorMsg}
        onStartGame={startGame}
        onBack={onBack}
      />
    );
  }

  return (
    <YesNoHome
      onBack={onBack}
      onJoined={handleJoined}
    />
  );
}
