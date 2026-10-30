import { getSupabase } from "../lib/supabase.js";
import type { GameItem } from "./gameState.js";

type Tier = "easy" | "medium" | "hard";

interface FlashRow {
  id: number;
  category: string;
  answer: string;
  difficulty: string;
  active: boolean;
}

const DURATION_BY_TIER: Record<Tier, number> = {
  easy: 900,
  medium: 700,
  hard: 500,
};

const pools: Record<Tier, GameItem[]> = { easy: [], medium: [], hard: [] };

function normalizeTier(d: string): Tier | null {
  const l = d.toLowerCase();
  if (l === "easy") return "easy";
  if (l === "medium") return "medium";
  if (l === "hard") return "hard";
  return null;
}

export async function loadConfusionEntries(): Promise<void> {
  const { data, error } = await getSupabase()
    .from("flash_items")
    .select("id, category, answer, difficulty, active")
    .eq("active", true);

  if (error) {
    console.error("[Supabase] ERROR: Failed to load flash_items:", error.message, error);
    throw new Error(`Supabase query failed for flash_items: ${error.message}`);
  }

  if (!data) {
    console.error("[Supabase] ERROR: flash_items returned no data.");
    throw new Error("flash_items returned null data from Supabase.");
  }

  const rows = data as FlashRow[];
  console.log(`[Supabase] Fetched ${rows.length} active entries from flash_items`);

  pools.easy = [];
  pools.medium = [];
  pools.hard = [];

  const skipped: string[] = [];
  for (const row of rows) {
    const tier = normalizeTier(row.difficulty);
    if (!tier) {
      skipped.push(`id=${row.id} difficulty="${row.difficulty}"`);
      continue;
    }
    pools[tier].push({
      type: "text",
      prompt: row.answer,
      correctAnswer: row.answer,
      acceptedAnswers: [],
      flashDurationMs: DURATION_BY_TIER[tier],
    });
  }

  if (skipped.length > 0) {
    console.warn("[Supabase] Skipped rows with unknown difficulty:", skipped.join(", "));
  }

  const counts = { easy: pools.easy.length, medium: pools.medium.length, hard: pools.hard.length };
  console.log("[Supabase] Fetched difficulties:", counts);
}

export function getFlashPool(tier: Tier): GameItem[] {
  return [...pools[tier]];
}

export function getConfusionItems(): GameItem[] {
  return [...pools.easy, ...pools.medium, ...pools.hard];
}

export function getRandomConfusionItems(count: number): GameItem[] {
  const all = getConfusionItems();
  return [...all].sort(() => Math.random() - 0.5).slice(0, Math.min(count, all.length));
}

export function getConfusionCount(): number {
  return pools.easy.length + pools.medium.length + pools.hard.length;
}
