/** Levenshtein-based string similarity, 0–1 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[。、！？!?.,;:'"「」『』【】（）()\s]/g, '')
    .trim();
}

/**
 * Returns a 0–1 score comparing spoken transcript against the target sentence.
 * Used for pronunciation check (simpler than full fluency scoring).
 */
export function stringSimilarityScore(transcript: string, target: string): number {
  const a = normalize(transcript);
  const b = normalize(target);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  return Math.max(0, 1 - levenshtein(a, b) / maxLen);
}
