export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\u0600-\u06FF]/g, "")
    .replace(/\s+/g, " ");
}

export function isCorrectAnswer(
  userAnswer: string,
  correctAnswer: string,
  acceptedAnswers: string[]
): boolean {
  const normalized = normalize(userAnswer);
  const correct = normalize(correctAnswer);

  if (normalized === correct) return true;

  for (const accepted of acceptedAnswers) {
    if (normalized === normalize(accepted)) return true;
  }

  return false;
}

export function calculatePoints(rank: number): number {
  if (rank === 1) return 5;
  if (rank === 2) return 3;
  return 1;
}
