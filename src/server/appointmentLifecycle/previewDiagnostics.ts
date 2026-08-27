/** Preview-only diagnostic endpoints and operator setup pages. */
export function isPreviewDiagnosticContext(): boolean {
  const context = process.env.CONTEXT?.trim();
  if (context === "production") {
    return false;
  }
  return true;
}
