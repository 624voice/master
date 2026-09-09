export function isReportDevEnabled(): boolean {
  if (process.env.ROI_REPORT_PREVIEW_ENABLED === "true") {
    return true;
  }

  const context =
    process.env.CONTEXT ?? process.env.NETLIFY_CONTEXT ?? process.env.DEPLOY_CONTEXT;
  return context === "deploy-preview";
}
