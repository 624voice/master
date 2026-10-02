/**
 * Audit disclosed preview URLs: anonymous must not receive application HTML (200 + text/html).
 */
const disclosed: Array<{ label: string; url: string }> = [
  { label: "canonical-owner-qa", url: "https://6abe969ae5d3846267f46778--624voice-phase2-owner-qa.netlify.app/" },
  { label: "legacy-6abd567", url: "https://6abd56734482b0f2f00832ab--624voice-phase2-owner-qa.netlify.app/" },
  { label: "legacy-6abd458", url: "https://6abd458bd2f3ce714ff6827a--624voice-phase2-owner-qa.netlify.app/" },
  { label: "pr98-deploy-preview", url: "https://deploy-preview-98--624voice.netlify.app/" },
  { label: "misconfig-both-missing", url: "https://6abe96031bef15a6e720a18c--624voice-phase2-owner-qa.netlify.app/" },
];

const extraDeployIds = [
  "6abe938e1c7372fd14f78262",
  "6abe96530466c407b762fea6",
  "6abe962ee1e6d472ef63ecce",
  "6abe93610cc4975d8dd13b7e",
];

for (const id of extraDeployIds) {
  disclosed.push({
    label: `qa-deploy-${id.slice(0, 8)}`,
    url: `https://${id}--624voice-phase2-owner-qa.netlify.app/`,
  });
}
extraDeployIds.push("6abe93610cc4975d8dd13b7e");
disclosed.push({
  label: "accidental-main-draft",
  url: "https://6abe93610cc4975d8dd13b7e--624voice.netlify.app/",
});

const results = [];
for (const entry of disclosed) {
  const base = entry.url.replace(/\/$/, "");
  for (const path of ["/", "/api/health"]) {
    const res = await fetch(`${base}${path}`, { redirect: "manual" });
    const body = await res.text();
    const contentType = res.headers.get("content-type") ?? "";
    const exposesApp =
      res.status === 200 &&
      (contentType.includes("text/html") || (path.includes("health") && body.includes("gitCommitSha")));
    results.push({
      ...entry,
      path,
      status: res.status,
      contentType,
      wwwAuthenticate: res.headers.get("www-authenticate") ? "present" : "absent",
      exposesPrivateBuildAnonymously: exposesApp,
      bodySample: body.slice(0, 60).replace(/\s+/g, " "),
    });
  }
}

console.log(JSON.stringify({ auditedAt: new Date().toISOString(), results }, null, 2));
const bad = results.filter((r) => r.exposesPrivateBuildAnonymously);
if (bad.length > 0) process.exit(1);
