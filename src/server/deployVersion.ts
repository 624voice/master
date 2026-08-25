export type DeployVersionInfo = {
  gitCommitSha: string;
  branch: string;
  deployContext: string;
  deployUrl: string;
  deployId: string;
  buildId: string;
  buildTimestamp: string | null;
  environment: "preview" | "production" | "local" | "unknown";
  speed2LeadLlmEnabled: boolean;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function resolveEnvironment(context: string | undefined): DeployVersionInfo["environment"] {
  if (context === "production") return "production";
  if (context === "deploy-preview" || context === "branch-deploy") return "preview";
  if (process.env.NODE_ENV !== "production") return "local";
  return context ? "unknown" : "local";
}

/** Non-sensitive deploy metadata for runtime boundary verification. */
export function buildDeployVersionInfo(now = new Date()): DeployVersionInfo {
  const deployContext = readEnv("CONTEXT") ?? readEnv("NETLIFY_CONTEXT") ?? "unknown";
  const gitCommitSha =
    readEnv("COMMIT_REF") ??
    readEnv("VERCEL_GIT_COMMIT_SHA") ??
    readEnv("GITHUB_SHA") ??
    "unknown";
  const branch =
    readEnv("BRANCH") ??
    readEnv("VERCEL_GIT_COMMIT_REF") ??
    readEnv("GITHUB_REF_NAME") ??
    "unknown";
  const deployUrl = readEnv("URL") ?? readEnv("DEPLOY_PRIME_URL") ?? "unknown";
  const deployId = readEnv("DEPLOY_ID") ?? readEnv("NETLIFY_DEPLOY_ID") ?? "unknown";
  const buildId = readEnv("BUILD_ID") ?? readEnv("NETLIFY_BUILD_ID") ?? "unknown";
  const buildTimestamp = readEnv("BUILD_TIMESTAMP") ?? null;

  return {
    gitCommitSha,
    branch,
    deployContext,
    deployUrl,
    deployId,
    buildId,
    buildTimestamp,
    environment: resolveEnvironment(deployContext),
    speed2LeadLlmEnabled: process.env.SPEED2LEAD_LLM_ENABLED === "true",
  };
}

export function deployVersionJson(now = new Date()): string {
  return JSON.stringify(buildDeployVersionInfo(now), null, 2);
}
