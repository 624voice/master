import { readFileSync } from "node:fs";

const artifact =
  process.env.PHASE2_PREVIEW_AUTH_ARTIFACT ?? "/opt/cursor/artifacts/netlify-owner-qa-preview-basic-auth.txt";
const base = process.env.POLISH_SCREENSHOT_BASE?.replace(/\/$/, "");
if (!base) throw new Error("POLISH_SCREENSHOT_BASE required");

const text = readFileSync(artifact, "utf8");
const map = Object.fromEntries(
  text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
) as Record<string, string>;
const auth = Buffer.from(`${map.user}:${map.password}`).toString("base64");

const paths = ["/", "/demo", "/contact"];
const needles = ["90-Day Results Guarantee", "recover at least our service investment", "Results Guarantee"];
const results = [];
for (const path of paths) {
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Basic ${auth}` } });
  const body = await res.text();
  results.push({
    path,
    status: res.status,
    hits: needles.filter((n) => body.includes(n)),
  });
}
console.log(JSON.stringify({ base, results }, null, 2));
if (results.some((r) => r.hits.length > 0)) process.exit(1);
