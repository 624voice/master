/** GSM-7 basic character set (single-segment safe subset). */
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

const GSM7_EXTENDED = "\\^{}[~]|€";

const GSM7_SET = new Set([...GSM7_BASIC, ...GSM7_EXTENDED]);

export function isGsm7Safe(text: string): boolean {
  for (const char of text) {
    if (!GSM7_SET.has(char)) {
      return false;
    }
  }
  return true;
}

export function gsm7UnitLength(text: string): number {
  let units = 0;
  for (const char of text) {
    if (GSM7_EXTENDED.includes(char)) {
      units += 2;
    } else if (GSM7_SET.has(char)) {
      units += 1;
    } else {
      // Non-GSM-7 → UCS-2 encoding
      return -1;
    }
  }
  return units;
}

export function countSmsSegments(text: string): {
  encoding: "GSM-7" | "UCS-2";
  units: number;
  segments: number;
} {
  const gsmUnits = gsm7UnitLength(text);
  if (gsmUnits >= 0) {
    const singleLimit = 160;
    const multiLimit = 153;
    const segments =
      gsmUnits <= singleLimit
        ? 1
        : Math.ceil(gsmUnits / multiLimit);
    return { encoding: "GSM-7", units: gsmUnits, segments };
  }

  const units = [...text].length;
  const singleLimit = 70;
  const multiLimit = 67;
  const segments = units <= singleLimit ? 1 : Math.ceil(units / multiLimit);
  return { encoding: "UCS-2", units, segments };
}

export function assertLifecycleMessageEncoding(label: string, text: string): void {
  if (!isGsm7Safe(text)) {
    const bad = [...text].filter((c) => !GSM7_SET.has(c));
    throw new Error(
      `${label} contains non-GSM-7 characters: ${[...new Set(bad)].join("")}`,
    );
  }
}
