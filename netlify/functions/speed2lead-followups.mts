export default async () => {
  const origin = process.env.URL ?? process.env.SITE_ORIGIN ?? "https://www.624voice.com";
  const secret = process.env.CRON_SECRET;

  const headers: Record<string, string> = {};
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  const endpoints = [
    "/api/cron/demo-followups",
    "/api/cron/nurture-followups",
    "/api/cron/agent-pain-prompts",
  ];
  const results: Array<{ endpoint: string; status: number; body: string }> = [];

  for (const endpoint of endpoints) {
    const response = await fetch(`${origin}${endpoint}`, { headers });
    results.push({
      endpoint,
      status: response.status,
      body: await response.text(),
    });
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = {
  schedule: "*/5 * * * *",
};
