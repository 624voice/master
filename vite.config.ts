import netlify from "@netlify/vite-plugin-tanstack-start";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

function readGitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function readGitBranch(): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

const deployContext = process.env.CONTEXT ?? process.env.NETLIFY_CONTEXT ?? "local";
const gitCommitSha =
  process.env.COMMIT_REF ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  readGitSha();
const gitBranch =
  process.env.BRANCH ??
  process.env.VERCEL_GIT_COMMIT_REF ??
  process.env.GITHUB_REF_NAME ??
  readGitBranch();

export default defineConfig({
  define: {
    __DEPLOY_GIT_COMMIT_SHA__: JSON.stringify(gitCommitSha),
    __DEPLOY_GIT_BRANCH__: JSON.stringify(gitBranch),
    __DEPLOY_CONTEXT__: JSON.stringify(deployContext),
    __DEPLOY_BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    port: 3000,
    host: true,
    // The site is reverse-proxied behind <label>.<PUBLIC_SITE_DOMAIN>; the proxy
    // masks the Host to localhost:3000, but accept any host so a dev server never
    // rejects a proxied request with "Blocked request".
    allowedHosts: true,
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    netlify(),
    viteReact(),
  ],
});
