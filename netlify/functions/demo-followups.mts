export default async () => {
  const origin = process.env.URL ?? process.env.SITE_ORIGIN ?? "https://www.624voice.com";
  const secret = process.env.CRON_SECRET;

  const headers: Record<string, string> = {};
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  const response = await fetch(`${origin}/api/cron/demo-followups`, { headers });
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = {
  schedule: "*/15 * * * *",
};
