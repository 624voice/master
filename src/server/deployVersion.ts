declare const __DEPLOY_GIT_COMMIT_SHA__: string;
declare const __DEPLOY_GIT_BRANCH__: string;
declare const __DEPLOY_CONTEXT__: string;
declare const __DEPLOY_BUILD_TIMESTAMP__: string;

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

function readBuildConstant(
  name: "gitCommitSha" | "branch" | "deployContext" | "buildTimestamp",
): string | undefined {
  try {
    if (name === "gitCommitSha") return __DEPLOY_GIT_COMMIT_SHA__;
    if (name === "branch") return __DEPLOY_GIT_BRANCH__;
    if (name === "deployContext") return __DEPLOY_CONTEXT__;
    return __DEPLOY_BUILD_TIMESTAMP__;
  } catch {
    return undefined;
  }
}

/** Non-sensitive deploy metadata for runtime boundary verification. */
export function buildDeployVersionInfo(now = new Date()): DeployVersionInfo {
  const deployContext =
    readEnv("CONTEXT") ??
    readEnv("NETLIFY_CONTEXT") ??
    readBuildConstant("deployContext") ??
    "unknown";
  const gitCommitSha =
    readEnv("COMMIT_REF") ??
    readEnv("VERCEL_GIT_COMMIT_SHA") ??
    readEnv("GITHUB_SHA") ??
    readBuildConstant("gitCommitSha") ??
    "unknown";
  const branch =
    readEnv("BRANCH") ??
    readEnv("VERCEL_GIT_COMMIT_REF") ??
    readEnv("GITHUB_REF_NAME") ??
    readBuildConstant("branch") ??
    "unknown";
  const deployUrl = readEnv("URL") ?? readEnv("DEPLOY_PRIME_URL") ?? "unknown";
  const deployId = readEnv("DEPLOY_ID") ?? readEnv("NETLIFY_DEPLOY_ID") ?? "unknown";
  const buildId = readEnv("BUILD_ID") ?? readEnv("NETLIFY_BUILD_ID") ?? "unknown";
  const buildTimestamp = readEnv("BUILD_TIMESTAMP") ?? readBuildConstant("buildTimestamp") ?? null;

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
