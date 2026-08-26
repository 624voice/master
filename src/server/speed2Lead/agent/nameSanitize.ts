/**
 * The ROI lead form's name field is free text with no validation, and real
 * testing showed it flowing straight into the SMS greeting unfiltered:
 * "Hey Johny," "Hey speed," "Hey dadf," "Hey d," "Hey f," "Hey 7," "Hey test."
 *
 * This rejects implausible names so the agent falls back to a name-less
 * greeting instead of looking broken from message one.
 */

const PLACEHOLDER_WORDS = new Set([
  "test",
  "testing",
  "asdf",
  "asd",
  "abc",
  "n/a",
  "na",
  "none",
  "unknown",
  "anonymous",
  "speed",
  "s2l",
  "demo",
]);

/** A real first name should be letters (plus common punctuation), at least 2 chars. */
const PLAUSIBLE_NAME_RE = /^[A-Za-z][A-Za-z'\-. ]{1,29}$/;

export function sanitizeFirstName(raw: string | undefined | null): string | undefined {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_WORDS.has(lower)) return undefined;

  // Single letters, digit strings, or keyboard-mash single tokens under 2 chars.
  if (trimmed.length < 2) return undefined;

  if (!PLAUSIBLE_NAME_RE.test(trimmed)) return undefined;

  // Reject repeated-character noise like "aaaa" or "ffff".
  if (/^(.)\1+$/.test(lower.replace(/[^a-z]/g, ""))) return undefined;

  // Title-case the first letter for consistent display; leave the rest as typed
  // (preserves names like "McKay" or "O'Brien" that the user typed correctly).
  return trimmed[0]!.toUpperCase() + trimmed.slice(1);
}
