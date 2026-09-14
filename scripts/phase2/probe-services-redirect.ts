/**
 * Records initial /services redirect behavior (no automatic redirect follow).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../..");
const OUT = join(REPO_ROOT, "review-artifacts/phase2/services-redirect-evidence.json");

async function waitForServer(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 120_000) {
    try {
      const res = await fetch("http://127.0.0.1:3000/");
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Server not ready");
}

function spawnServer(): ChildProcess {
  return spawn("bun", ["run", "start"], {
    cwd: REPO_ROOT,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function curlNoFollow(url: string): Promise<{ status: number; location: string | null }> {
  const proc = Bun.spawn(
    ["curl", "-sS", "-I", "--max-redirs", "0", "-w", "\nHTTP_CODE:%{http_code}", url],
    { stdout: "pipe" },
  );
  const text = await new Response(proc.stdout).text();
  const statusMatch = text.match(/HTTP_CODE:(\d+)/);
  const locationMatch = text.match(/^location:\s*(.+)$/im);
  return {
    status: statusMatch ? Number(statusMatch[1]) : 0,
    location: locationMatch ? locationMatch[1]!.trim() : null,
  };
}

async function curlFollow(url: string): Promise<{ status: number; finalUrl: string }> {
  const proc = Bun.spawn(
    ["curl", "-sS", "-L", "-o", "/dev/null", "-w", "%{http_code}|%{url_effective}", url],
    { stdout: "pipe" },
  );
  const text = (await new Response(proc.stdout).text()).trim();
  const [status, finalUrl] = text.split("|");
  return { status: Number(status), finalUrl: finalUrl ?? url };
}

async function main(): Promise<void> {
  const build = Bun.spawn(["bun", "run", "build"], { cwd: REPO_ROOT, stdout: "inherit", stderr: "inherit" });
  if ((await build.exited) !== 0) process.exit(1);

  const server = spawnServer();
  try {
    await waitForServer();
    const initial = await curlNoFollow("http://127.0.0.1:3000/services");
    const final = await curlFollow("http://127.0.0.1:3000/services");

    const evidence = {
      route: "/services",
      initialResponseStatusBeforeFollow: initial.status,
      locationHeader: initial.location,
      expectedDestination: "/what-we-do",
      finalResponseStatusAfterFollow: final.status,
      finalUrl: final.finalUrl,
      canonicalAndIndexing:
        "Retired /services route uses TanStack beforeLoad redirect to /what-we-do; no standalone indexable content at /services.",
      note: "Do not report initial response as HTTP 200 when the client followed redirects automatically.",
      probedAt: new Date().toISOString(),
    };

    writeFileSync(OUT, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
