import { supabase } from "../lib/supabase.js";
import type { GameItem } from "./gameState.js";

let confusionItems: GameItem[] = [];

export async function loadConfusionEntries(): Promise<void> {
  const { data, error } = await supabase
    .from("confusing_entries")
    .select("id, entry");

  if (error) {
    console.error(
      "[Supabase] ERROR: Failed to load confusion entries:",
      error.message,
      error,
    );
    throw new Error(
      `Supabase query failed for confusing_entries: ${error.message}`,
    );
  }

  if (!data) {
    console.error("[Supabase] ERROR: confusing_entries returned no data.");
    throw new Error("confusing_entries returned null data from Supabase.");
  }

  confusionItems = (data as { id: number; entry: string }[]).map((row) => ({
    type: "text" as const,
    prompt: row.entry,
    correctAnswer: row.entry,
    acceptedAnswers: [],
    flashDurationMs: 600,
  }));

  console.log(
    `[Supabase] Loaded ${confusionItems.length} confusion entries from Supabase`,
  );
}

export function getConfusionItems(): GameItem[] {
  return [...confusionItems];
}

export function getRandomConfusionItems(count: number): GameItem[] {
  const shuffled = [...confusionItems].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function getConfusionCount(): number {
  return confusionItems.length;
}
