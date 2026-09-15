/**
 * Safe local preview for owner human keyboard QA (A11Y-090).
 * Starts buildAssessmentBrowserServer({ safeBackend: true }) on http://127.0.0.1:3000
 * with stripped credentials and Redis stub — no live providers.
 *
 * Run: bun run scripts/phase2/start-safe-assessment-preview.ts
 */
import {
  buildAssessmentBrowserServer,
  ensureAssessmentBrowserBuild,
  waitForServer,
} from "../../src/browser-journey/assessmentBrowserJourneySupport";

const BASE_URL = "http://127.0.0.1:3000";

async function main(): Promise<void> {
  console.log("Phase 2 safe owner preview — human keyboard QA only");
  console.log("Do NOT use Puppeteer, Playwright, scripted input, or AI browser control.");
  console.log("Unset production credentials before starting (Twilio, SendGrid, Upstash, Google, live SMS flag).");
  await ensureAssessmentBrowserBuild();
  buildAssessmentBrowserServer({ safeBackend: true });
  await new Promise((r) => setTimeout(r, 3000));
  await waitForServer(`${BASE_URL}/assessment`);
  console.log(`Safe preview ready: ${BASE_URL}`);
  console.log("Confirm: no live SMS/call/email/CRM/webhook/analytics dispatch.");
  console.log("Press Ctrl+C to stop the preview server.");
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
