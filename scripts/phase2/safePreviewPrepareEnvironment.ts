/**
 * Sanitized child environment for one-time safe preview preparation (network phase).
 * Never passes parent credentials, credential files, or project .env into bun/docker.
 */
import {
  BOOTSTRAP_KEYS,
  findProhibitedEnvKeys,
  isProhibitedEnvKey,
} from "./safePreviewEnvironment";
import {
  applyIsolationPaths,
  createSafePreviewIsolation,
  CREDENTIAL_FILE_ENV_KEYS,
  type SafePreviewIsolation,
} from "./safePreviewIsolation";

export const PREP_BOUNDARY = "PHASE2_SAFE_PREP" as const;

/** Minimum Docker plumbing — no registry tokens from parent. */
export const DOCKER_PREP_BOOTSTRAP_KEYS = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "TERM",
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
] as const;

const FORCED_PREP_VALUES: Record<string, string> = {
  [PREP_BOUNDARY]: "1",
  NODE_ENV: "production",
  npm_config_ignore_scripts: "true",
};

export type PrepareEnvironment = {
  env: Record<string, string>;
  isolation: SafePreviewIsolation;
};

export function buildIsolatedPrepareEnvironment(
  parentEnv: NodeJS.ProcessEnv = process.env,
): PrepareEnvironment {
  const isolation = createSafePreviewIsolation();
  const env: Record<string, string> = {};

  for (const key of BOOTSTRAP_KEYS) {
    const value = parentEnv[key];
    if (value != null && value !== "") env[key] = value;
  }
  for (const key of DOCKER_PREP_BOOTSTRAP_KEYS) {
    const value = parentEnv[key];
    if (value != null && value !== "" && env[key] == null) env[key] = value;
  }

  Object.assign(env, FORCED_PREP_VALUES);
  applyIsolationPaths(env, isolation);

  env.DOCKER_CONFIG = `${isolation.xdgConfigHome}/docker-empty`;
  env.BUN_INSTALL_CACHE_DIR = `${isolation.xdgCacheHome}/bun-install`;

  for (const key of Object.keys(env)) {
    if (isProhibitedEnvKey(key)) delete env[key];
  }
  for (const key of CREDENTIAL_FILE_ENV_KEYS) {
    delete env[key];
  }

  return { env, isolation };
}

export function findPrepareProhibitedKeys(env: Record<string, string>): string[] {
  return Object.keys(env).filter((key) => isProhibitedEnvKey(key)).sort();
}

export function assertPrepareEnvironment(env: Record<string, string>): void {
  const violations = findPrepareProhibitedKeys(env);
  if (violations.length > 0) {
    throw new Error(
      `Safe preparation environment check failed: prohibited variable(s): ${violations.join(", ")}`,
    );
  }
  if (env[PREP_BOUNDARY] !== "1") {
    throw new Error(`${PREP_BOUNDARY}=1 missing`);
  }
  if (!env.HOME?.includes("phase2-safe-preview-")) {
    throw new Error("Prepare HOME isolation failed");
  }
  for (const key of CREDENTIAL_FILE_ENV_KEYS) {
    if (env[key]) throw new Error(`Credential file env leaked: ${key}`);
  }
}

export function redactForLogs(text: string, markers: string[]): string {
  let out = text;
  for (const marker of markers) {
    out = out.split(marker).join("[REDACTED-PROBE]");
  }
  return out;
}
