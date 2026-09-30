/**
 * Temporary HOME and XDG isolation for safe preview — never reuses parent credential paths.
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type SafePreviewIsolation = {
  tempRoot: string;
  home: string;
  xdgConfigHome: string;
  xdgCacheHome: string;
  xdgDataHome: string;
  bunConfigDir: string;
  npmConfigPath: string;
  cleanup: () => void;
};

export function createSafePreviewIsolation(): SafePreviewIsolation {
  const tempRoot = mkdtempSafe();
  const home = join(tempRoot, "home");
  const xdgConfigHome = join(tempRoot, "xdg-config");
  const xdgCacheHome = join(tempRoot, "xdg-cache");
  const xdgDataHome = join(tempRoot, "xdg-data");
  const bunConfigDir = join(xdgConfigHome, "bun");
  const npmConfigPath = join(xdgConfigHome, "empty-npmrc");

  for (const dir of [home, xdgConfigHome, xdgCacheHome, xdgDataHome, bunConfigDir]) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  return {
    tempRoot,
    home,
    xdgConfigHome,
    xdgCacheHome,
    xdgDataHome,
    bunConfigDir,
    npmConfigPath,
    cleanup: () => {
      try {
        rmSync(tempRoot, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    },
  };
}

function mkdtempSafe(): string {
  return mkdtempSync(join(tmpdir(), "phase2-safe-preview-"));
}

/** Credential-file and config env keys that must never pass through from parent. */
export const CREDENTIAL_FILE_ENV_KEYS = [
  "AWS_SHARED_CREDENTIALS_FILE",
  "AWS_CONFIG_FILE",
  "AWS_PROFILE",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "NETRC",
  "NPM_CONFIG_USERCONFIG",
  "NPM_CONFIG_GLOBALCONFIG",
  "NPM_CONFIG_CACHE",
  "BUN_AUTH_TOKEN",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "DOTENV_CONFIG_PATH",
] as const;

export function applyIsolationPaths(
  env: Record<string, string>,
  isolation: SafePreviewIsolation,
): Record<string, string> {
  env.HOME = isolation.home;
  env.XDG_CONFIG_HOME = isolation.xdgConfigHome;
  env.XDG_CACHE_HOME = isolation.xdgCacheHome;
  env.XDG_DATA_HOME = isolation.xdgDataHome;
  env.BUN_INSTALL_CACHE_DIR = join(isolation.xdgCacheHome, "bun-install");
  env.TMPDIR = join(isolation.tempRoot, "tmp");
  mkdirSync(env.TMPDIR, { recursive: true, mode: 0o700 });
  env.npm_config_userconfig = isolation.npmConfigPath;
  env.npm_config_globalconfig = isolation.npmConfigPath;
  for (const key of CREDENTIAL_FILE_ENV_KEYS) {
    delete env[key];
  }
  return env;
}
