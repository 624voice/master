/**
 * In-memory Upstash Redis REST stub for safe browser-journey tests.
 */
const store = new Map<string, unknown>();

function commandResult(parts: string[]): unknown {
  const cmd = parts[0]?.toLowerCase();
  if (cmd === "get") {
    return store.get(parts[1] ?? "") ?? null;
  }
  if (cmd === "set") {
    store.set(parts[1] ?? "", parts[2]);
    return "OK";
  }
  if (cmd === "del") {
    for (const key of parts.slice(1)) store.delete(key);
    return parts.length - 1;
  }
  if (cmd === "eval") {
    const numKeys = Number(parts[2] ?? 1);
    if (numKeys === 1) {
      return [1, 1, "allowed"];
    }
    return ["a", "fresh", 1, 1, null];
  }
  return "OK";
}

function pipelineResponse(body: unknown): Response {
  const commands = Array.isArray(body) ? body : [];
  const results = commands.map((cmd) => {
    const parts = Array.isArray(cmd) ? cmd.map(String) : [];
    return { result: commandResult(parts) };
  });
  return Response.json(results);
}

const server = Bun.serve({
  port: Number(process.env.PHASE2_REDIS_STUB_PORT ?? 8787),
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (url.pathname === "/leads-webhook") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }
    const rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : null;

    if (url.pathname.includes("pipeline") || url.pathname.includes("multi-exec")) {
      return pipelineResponse(body);
    }

    if (Array.isArray(body) && typeof body[0] === "string") {
      return Response.json({ result: commandResult(body.map(String)) });
    }

    return Response.json({ result: "OK" });
  },
});

console.log(`upstash-redis-stub listening on ${server.port}`);
