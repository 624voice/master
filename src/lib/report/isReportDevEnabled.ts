declare const __DEPLOY_CONTEXT__: string;

function readDeployContext(): string | undefined {
  const fromEnv =
    process.env.CONTEXT?.trim() ||
    process.env.NETLIFY_CONTEXT?.trim() ||
    process.env.DEPLOY_CONTEXT?.trim();
  if (fromEnv) return fromEnv;

  try {
    return __DEPLOY_CONTEXT__;
  } catch {
    return undefined;
  }
}

export function isReportDevEnabled(): boolean {
  if (process.env.ROI_REPORT_PREVIEW_ENABLED === "true") {
    return true;
  }

  const context = readDeployContext();
  return context === "deploy-preview";
}
