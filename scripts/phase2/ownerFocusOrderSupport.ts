/**
 * Shared focus-order helpers for owner keyboard walkthrough capture and tests.
 */
import type { Page } from "puppeteer-core";

export type FocusDescriptor = {
  tag: string;
  role: string | null;
  name: string;
  id: string | null;
  href: string | null;
};

const DESCRIBE_FOCUS_FN = () => {
  function describe(el: Element | null): {
    tag: string;
    role: string | null;
    name: string;
    id: string | null;
    href: string | null;
  } {
    if (!el || el === document.body) {
      return {
        tag: "BODY",
        role: null,
        name: "(document body — no control focused)",
        id: null,
        href: null,
      };
    }
    const html = el as HTMLElement;
    const tag = html.tagName;
    const role = html.getAttribute("role");
    const id = html.getAttribute("id");
    const href = html.getAttribute("href");
    const ariaLabel = html.getAttribute("aria-label");
    const labelledBy = html.getAttribute("aria-labelledby");
    let name =
      ariaLabel ??
      (labelledBy
        ? document.getElementById(labelledBy)?.textContent?.trim()
        : null) ??
      html.innerText?.trim().replace(/\s+/g, " ").slice(0, 80) ??
      html.getAttribute("alt") ??
      html.getAttribute("placeholder") ??
      "";
    if (tag === "SELECT" && html instanceof HTMLSelectElement) {
      name = html.options[html.selectedIndex]?.text?.trim() ?? name;
    }
    if (tag === "INPUT" && html instanceof HTMLInputElement) {
      name = name || (html.type === "checkbox" ? "checkbox" : html.type);
    }
    if (tag === "SUMMARY") {
      name = name || "Mobile navigation menu";
    }
    return { tag, role, name, id, href };
  }
  return describe(document.activeElement);
};

export function formatFocusDescriptor(d: FocusDescriptor): string {
  if (d.tag === "BODY") return d.name;
  const parts = [d.tag];
  if (d.role) parts.push(`role=${d.role}`);
  if (d.name) parts.push(d.name);
  if (d.id) parts.push(`#${d.id}`);
  return parts.join(": ");
}

export async function readFocused(page: Page): Promise<FocusDescriptor> {
  return page.evaluate(DESCRIBE_FOCUS_FN) as Promise<FocusDescriptor>;
}

export async function pressTabAndRead(page: Page): Promise<FocusDescriptor> {
  await page.keyboard.press("Tab");
  return readFocused(page);
}

export async function captureTabSequence(
  page: Page,
  count: number,
): Promise<FocusDescriptor[]> {
  const sequence: FocusDescriptor[] = [];
  for (let i = 0; i < count; i += 1) {
    sequence.push(await pressTabAndRead(page));
  }
  return sequence;
}

export async function resetFocusFromPageLoad(page: Page): Promise<FocusDescriptor> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    document.body.focus();
  });
  await page.keyboard.press("Tab");
  return readFocused(page);
}
