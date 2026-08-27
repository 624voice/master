function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

export function buildShortNeedSummary(message: string): string {
  const text = message.trim().toLowerCase();

  if (includesAny(text, ["website", "web site", "webpage"])) {
    return "a new website";
  }
  if (includesAny(text, ["ai agent", "voice ai", "ai receptionist", "virtual receptionist"])) {
    return "an AI voice agent";
  }
  if (includesAny(text, ["missed call", "answering service", "answer calls", "call handling"])) {
    return "better call handling";
  }
  if (includesAny(text, ["lead", "follow-up", "follow up", "followup"])) {
    return "lead follow-up";
  }
  if (includesAny(text, ["schedule", "scheduling", "booking appointments"])) {
    return "scheduling support";
  }

  const cleaned = message.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return "your request";
  }
  if (cleaned.length <= 50) {
    return cleaned;
  }

  return `${cleaned.slice(0, 47)}...`;
}
