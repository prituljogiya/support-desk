export type SuggestCandidate = {
  id: string;
  title: string;
  body: string;
  keywords: string;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function suggestCannedReplies(
  subject: string,
  description: string,
  candidates: SuggestCandidate[],
  limit = 3,
) {
  const queryTokens = new Set(tokenize(`${subject} ${description}`));
  if (queryTokens.size === 0) return [];

  const scored = candidates
    .map((c) => {
      const hay = tokenize(`${c.title} ${c.keywords} ${c.body}`);
      let overlap = 0;
      for (const t of hay) {
        if (queryTokens.has(t)) overlap += 1;
      }
      return { ...c, score: overlap };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return scored.slice(0, limit);
}
