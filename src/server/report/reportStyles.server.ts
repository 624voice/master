import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FONT_FILES = [
  ["Inter-Regular.woff2", 400],
  ["Inter-Medium.woff2", 500],
  ["Inter-SemiBold.woff2", 600],
  ["Inter-Bold.woff2", 700],
  ["Inter-ExtraBold.woff2", 800],
] as const;

function readAsset(relativePath: string): Uint8Array {
  for (const base of [
    join(process.cwd(), "public", relativePath),
    join(process.cwd(), "dist", "client", relativePath),
  ]) {
    if (existsSync(base)) {
      return readFileSync(base);
    }
  }
  throw new Error(`Report asset not found: ${relativePath}`);
}

function toDataUri(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

export function loadReportPrintCss(): string {
  for (const path of [
    join(process.cwd(), "src/styles/report-print.css"),
    join(process.cwd(), "dist/server/assets/report-print.css"),
  ]) {
    if (existsSync(path)) {
      return readFileSync(path, "utf8");
    }
  }
  throw new Error("report-print.css not found");
}

export function buildReportPrintCssForPdf(): string {
  let css = loadReportPrintCss();

  for (const [filename, weight] of FONT_FILES) {
    const bytes = readAsset(join("fonts/inter", filename));
    const dataUri = toDataUri(bytes, "font/woff2");
    css = css.replace(
      `url("/fonts/inter/${filename}")`,
      `url("${dataUri}")`,
    );
    css = css.replace(
      `@font-face {\n  font-family: "Inter Report";\n  font-style: normal;\n  font-weight: ${weight};`,
      `@font-face {\n  font-family: "Inter Report";\n  font-style: normal;\n  font-weight: ${weight};`,
    );
  }

  return css;
}

export function loadReportLogoDataUri(): string {
  const bytes = readAsset("report-logo.png");
  return toDataUri(bytes, "image/png");
}
