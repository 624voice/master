import { describe, expect, test } from "bun:test";
import { PDFParse } from "pdf-parse";
import { PDFDocument, PDFDict, PDFName, PDFString } from "pdf-lib";
import { BOOK_MEETING_PATH, SITE_ORIGIN } from "~/config/features";
import { buildNorthstarReportViewModel } from "~/lib/report/__fixtures__/northstar";
import {
  GUARANTEE_CARD_TITLE,
  GUARANTEE_FOOTNOTE,
  MODEL_CARD_EYEBROW,
  PAGE1_HERO_HEADLINE,
  SECTION_02_REALIZATION_LEAD,
  SECTION_03_TITLE,
  SECTION_05_TITLE,
  SECTION_06_TITLE,
  ORCHESTRATION_TITLE,
} from "~/lib/report/reportCopy";
import { renderReportPdf } from "~/server/report/renderReportPdf.server";

const BOOKING_URL = `${SITE_ORIGIN}${BOOK_MEETING_PATH}`;

async function extractPdfText(pdf: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data: Buffer.from(pdf) });
  const parsed = await parser.getText();
  return parsed.text;
}

async function extractLinkUrls(pdf: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(pdf);
  const urls: string[] = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i);
    const annotsRef = page.node.get(PDFName.of("Annots"));
    if (!annotsRef) continue;
    const annots = doc.context.lookup(annotsRef);
    if (!annots || !("size" in annots)) continue;
    for (let j = 0; j < annots.size(); j++) {
      const annot = doc.context.lookup(annots.get(j));
      if (!(annot instanceof PDFDict)) continue;
      if (annot.get(PDFName.of("Subtype"))?.toString() !== "/Link") continue;
      const action = doc.context.lookup(annot.get(PDFName.of("A")));
      if (!(action instanceof PDFDict)) continue;
      const uri = action.get(PDFName.of("URI"));
      if (uri instanceof PDFString) urls.push(uri.decodeText());
    }
  }
  return urls;
}

async function countAcroFormFields(pdf: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(pdf);
  try {
    return doc.getForm().getFields().length;
  } catch {
    return 0;
  }
}

describe("renderReportPdf", () => {
  test(
    "generates a 4-page PDF with expected content and on-site booking link",
    async () => {
      const model = buildNorthstarReportViewModel();
      const { pdf, timing } = await renderReportPdf(model, {
        mode: "cold",
        collectTiming: true,
      });

      expect(pdf.byteLength).toBeGreaterThan(10_000);
      expect(timing?.pageCount).toBe(4);
      expect(await countAcroFormFields(pdf)).toBe(0);

      const text = await extractPdfText(pdf);
      expect(text.replace(/\s+/g, " ")).toContain(
        PAGE1_HERO_HEADLINE.replace(/\s+/g, " "),
      );
      expect(text).toContain(model.moderateHeroTotalFormatted);
      expect(text).toContain("Prepared for Jordan Miller · Northstar Pest Control");
      const normalizedText = text.replace(/\s+/g, " ").replace(/-\s+/g, "-");
      expect(normalizedText).toContain(
        "recover at least our service investment in booked service-visit revenue within 90 days of go-live",
      );
      expect(normalizedText).toContain(GUARANTEE_FOOTNOTE);
      expect(text).toContain("Book More Jobs");
      expect(text).toContain("Cut Your No-Shows");
      expect(text).toContain("Win More Repeat Revenue with Customers You Already Have");
      expect(text).not.toContain("Most home-service businesses aren't losing money");
      expect(text).not.toContain("Missed Calls");
      expect(text).not.toContain("Upsell Revenue Left on the Table");
      expect(text).toContain(SECTION_02_REALIZATION_LEAD);
      expect(text).toContain(SECTION_03_TITLE);
      const guaranteeIdx = normalizedText.indexOf("Our risk, not yours");
      const ctaIdx = normalizedText.indexOf("What happens next");
      expect(guaranteeIdx).toBeGreaterThan(-1);
      expect(ctaIdx).toBeGreaterThan(guaranteeIdx);
      expect(text.toUpperCase()).toContain(MODEL_CARD_EYEBROW.toUpperCase());
      expect(text).toContain(SECTION_05_TITLE);
      expect(text.replace(/\s+/g, " ")).toMatch(/90.{0,4}Day Results Guarantee/);
      expect(text).toContain(SECTION_06_TITLE);
      expect(text).toContain(ORCHESTRATION_TITLE);
      expect(text).not.toContain("MORE THAN AN AI RECEPTIONIST");
      expect(text.replace(/\s+/g, " ")).toContain("No double-counting");
      expect(text).not.toContain("Missed-Call Recovery");
      expect(text).not.toContain("See it work on your calls");
      expect(text).not.toContain("See where it's going");
      expect(text).toContain("See your AI front office work live in 25 minutes.");
      expect(await extractLinkUrls(pdf)).toContain(BOOKING_URL);
    },
    { timeout: 120_000 },
  );
});
