import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLIENT_ENGAGEMENT_STEPS,
  HOW_WE_WORK_STEPS,
} from "~/content/clientEngagementProcess";
import { CUSTOMER_JOURNEY_STAGES } from "~/content/customerJourneyStages";
import { FEATURE_FLAGS } from "~/config/features";
import {
  FLEET_SIZE_LABELS,
  FLEET_SIZE_RANGES,
} from "~/lib/lead/validateLead";

const REPO = join(import.meta.dirname, "../..");

describe("Phase 2 website polish regression", () => {
  test("fleet five-band labels include 50+ trucks in Assessment and Contact", () => {
    expect(FLEET_SIZE_RANGES).toEqual(["1-2", "3-7", "8-20", "21-50", "50+"]);
    expect(FLEET_SIZE_LABELS["50+"]).toBe("50+ trucks");
    const contact = readFileSync(join(REPO, "src/routes/contact.tsx"), "utf8");
    const assessmentQuestion = readFileSync(
      join(REPO, "src/components/assessment/AssessmentQuestion.tsx"),
      "utf8",
    );
    expect(contact).toContain("FLEET_SIZE_RANGES");
    expect(assessmentQuestion).toContain("FLEET_SIZE_LABELS");
  });

  test("four-step engagement titles match on Home and How We Work", () => {
    const homeTitles = CLIENT_ENGAGEMENT_STEPS.map((s) => s.title);
    const howTitles = HOW_WE_WORK_STEPS.map((s) => s.title);
    expect(homeTitles).toEqual(howTitles);
    expect(homeTitles).toEqual([
      "Diagnose the Leaks",
      "Build the Roadmap",
      "Connect the System",
      "Prove and Improve",
    ]);
  });

  test("customer journey has six stages with accessible descriptions", () => {
    expect(CUSTOMER_JOURNEY_STAGES).toHaveLength(6);
    for (const stage of CUSTOMER_JOURNEY_STAGES) {
      expect(stage.primaryLabel.length).toBeGreaterThan(0);
      expect(stage.description.length).toBeGreaterThan(10);
    }
  });

  test("page title strings", () => {
    const index = readFileSync(join(REPO, "src/routes/index.tsx"), "utf8");
    expect(index).toContain('"AI Growth Systems for Home Services | 624 Voice"');
    const book = readFileSync(join(REPO, "src/routes/book.tsx"), "utf8");
    expect(book).toContain('"Schedule Your Consultation | 624 Voice"');
  });

  test("footer has single /contact link and no duplicate Book a Time footer entry", () => {
    const root = readFileSync(join(REPO, "src/routes/__root.tsx"), "utf8");
    const footerMatch = root.match(/function Footer\([\s\S]*?\n\}/);
    expect(footerMatch).toBeTruthy();
    const footer = footerMatch![0];
    const contactLinks = footer.match(/href="\/contact"/g) ?? [];
    expect(contactLinks.length).toBe(1);
    expect(footer).not.toMatch(/href="\/book"/);
    expect(footer).toContain("Book a Consultation");
  });

  test("general consultation CTAs route to /contact; qualified book route preserved", () => {
    const root = readFileSync(join(REPO, "src/routes/__root.tsx"), "utf8");
    expect(root).toContain('href="/contact"');
    const results = readFileSync(
      join(REPO, "src/components/assessment/AssessmentResults.tsx"),
      "utf8",
    );
    expect(results).toContain("BOOK_MEETING_PATH");
  });

  test("assessment hero component stays mounted outside step conditionals", () => {
    const assessment = readFileSync(join(REPO, "src/routes/assessment.tsx"), "utf8");
    expect(assessment).toContain("<AssessmentPageHero />");
    const hero = readFileSync(
      join(REPO, "src/components/assessment/AssessmentPageHero.tsx"),
      "utf8",
    );
    expect(hero).toContain('data-testid="assessment-hero"');
  });

  test("SHOW_VOICE_AI_GUARANTEE default false", () => {
    expect(FEATURE_FLAGS.SHOW_VOICE_AI_GUARANTEE).toBe(false);
  });

  test("demo copy does not claim visitor voice selector", () => {
    const demoHero = readFileSync(
      join(REPO, "src/components/demo/DemoHeroLeft.tsx"),
      "utf8",
    );
    expect(demoHero.toLowerCase()).not.toContain("voice selector");
    expect(demoHero).toContain("Jessica");
  });

  test("roi-calculator route file unchanged entry", () => {
    const roi = readFileSync(join(REPO, "src/routes/roi-calculator.tsx"), "utf8");
    expect(roi).toContain("RoiCalculator");
  });

  test("booking embed loading and fallback copy", () => {
    const embed = readFileSync(join(REPO, "src/components/GoogleCalendarEmbed.tsx"), "utf8");
    expect(embed).toContain("Loading available consultation times");
    expect(embed).toContain("Having trouble loading the calendar");
    expect(embed).toContain("BOOK_MEETING_URL");
  });
});
