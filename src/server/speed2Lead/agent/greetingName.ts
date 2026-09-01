/**
 * Bare first-name validity for greetings. Rejects only clearly broken
 * values — no fuzzy/heuristic sanitization.
 */
const REJECTED_NAME_RE = /^(test|asdf|n\/?a|none|xxx)$/i;

export function usableGreetingName(firstName?: string): string | undefined {
  const name = firstName?.trim();
  if (!name) return undefined;
  if (name.length === 1) return undefined;
  if (/^\d+$/.test(name)) return undefined;
  if (REJECTED_NAME_RE.test(name)) return undefined;
  return name;
}
