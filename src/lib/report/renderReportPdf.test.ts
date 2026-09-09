import { describe, expect, test } from "bun:test";
import { PDFParse } from "pdf-parse";
import { PDFDocument, PDFDict, PDFName, PDFString } from "pdf-lib";
import { buildNorthstarReportViewModel } from "~/lib/report/__fixtures__/northstar";
import { GUARANTEE_BODY } from "~/lib/report/reportCopy";
import { BOOK_MEETING_URL } from "~/config/features";
import { renderReportPdf } from "~/server/report/renderReportPdf.server";

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
    "generates a 4-page PDF with expected content and no AcroForm fields",
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
      expect(text).toContain(model.moderateHeroTotalFormatted);
      expect(text.replace(/\s+/g, " ")).toContain(
        GUARANTEE_BODY.replace(/\s+/g, " "),
      );
      for (const driver of model.drivers) {
        expect(text).toContain(driver.label);
      }
      expect(text).toContain("Total modeled annual opportunity");
      expect(await extractLinkUrls(pdf)).toContain(BOOK_MEETING_URL);
    },
    { timeout: 120_000 },
  );
});
