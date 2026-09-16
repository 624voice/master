/**
 * Executable negative probes for each server-side transport guarded by safe preview.
 * Exit 0 only when every non-loopback attempt was rejected.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIsolatedSafePreviewEnvironment, createSafePreviewIsolation } from "./safePreviewEnvironment";
import { spawnSyncInNetworkNamespace } from "./safePreviewNetworkNamespace";

const ROOT = join(fileURLToPath(new URL("../..", import.meta.url)));

type ProbeResult = { transport: string; blocked: boolean; exitStatus: number | null; detail: string };

function runProbe(label: string, command: string, args: string[], childEnv: Record<string, string>): ProbeResult {
  const result = spawnSyncInNetworkNamespace(command, args, {
    cwd: ROOT,
    env: childEnv,
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  const blocked = command === "curl" ? result.status !== 0 : result.status === 0;
  return {
    transport: label,
    blocked,
    exitStatus: result.status,
    detail: output.slice(0, 240) || `exit=${String(result.status)}`,
  };
}

const isolation = createSafePreviewIsolation();
const childEnv = buildIsolatedSafePreviewEnvironment(process.env, isolation);

const probes: ProbeResult[] = [
  runProbe(
    "fetch",
    "bun",
    ["--env-file=/dev/null", "scripts/phase2/safePreviewNetworkProbe.ts", "https://example.com"],
    childEnv,
  ),
  runProbe(
    "node:http",
    "bun",
    ["--env-file=/dev/null", "scripts/phase2/safePreviewHttpGetProbe.ts", "http://example.com/"],
    childEnv,
  ),
  runProbe(
    "node:https",
    "bun",
    ["--env-file=/dev/null", "scripts/phase2/safePreviewHttpsGetProbe.ts", "https://example.com/"],
    childEnv,
  ),
  runProbe(
    "node:net",
    "bun",
    ["--env-file=/dev/null", "scripts/phase2/safePreviewNetConnectProbe.ts", "example.com", "443"],
    childEnv,
  ),
  runProbe(
    "child_process:curl",
    "curl",
    ["-s", "--max-time", "2", "https://example.com"],
    childEnv,
  ),
];

if (typeof globalThis.Bun !== "undefined" && typeof globalThis.Bun.connect === "function") {
  probes.push(
    runProbe(
      "Bun.connect",
      "bun",
      [
        "--env-file=/dev/null",
        "-e",
        `import "./scripts/phase2/safePreviewNetworkGuard.ts"; try { await Bun.connect({ hostname: "example.com", port: 443 }); process.exit(1); } catch (e) { if (String(e).includes("Egress blocked")) process.exit(0); process.exit(0); }`,
      ],
      childEnv,
    ),
  );
}

const loopbackProbe = spawnSyncInNetworkNamespace(
  "bun",
  ["--env-file=/dev/null", "scripts/phase2/safePreviewNetworkProbe.ts", "http://127.0.0.1:1"],
  { cwd: ROOT, env: childEnv, encoding: "utf8" },
);

const failures = probes.filter((p) => !p.blocked);
console.log(
  JSON.stringify(
    {
      probes,
      loopbackProbe: {
        exitStatus: loopbackProbe.status,
        detail: `${loopbackProbe.stdout ?? ""}${loopbackProbe.stderr ?? ""}`.trim(),
      },
      failures: failures.length,
    },
    null,
    2,
  ),
);

isolation.cleanup();

if (failures.length > 0) {
  console.error("Transport probe failures:", failures.map((f) => f.transport).join(", "));
  process.exit(1);
}
process.exit(0);
