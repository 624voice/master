/** Poll host-published preview until /assessment responds or timeout. */
import { spawnSync } from "node:child_process";

export async function waitForDockerPreviewReady(
  baseUrl = "http://127.0.0.1:3000",
  timeoutMs = 120000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const probe = spawnSync(
      "curl",
      ["-s", "-o", "/dev/null", "-w", "%{http_code}", `${baseUrl}/assessment`],
      { encoding: "utf8" },
    );
    const code = probe.stdout.trim();
    if (/^200|307|308$/.test(code)) return;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Docker preview did not become ready at ${baseUrl} within ${timeoutMs}ms`);
}
