import { afterEach, describe, expect, mock, test } from "bun:test";

describe("generateRoiPdf workflow ordering", () => {
  afterEach(() => {
    mock.restore();
  });

  test("handler source preserves saveLead → renderReportPdf → SMS order", async () => {
    const source = await Bun.file(
      `${import.meta.dir}/generateRoiPdfHandler.server.ts`,
    ).text();
    const saveLeadIndex = source.indexOf("await saveLead({");
    const renderIndex = source.indexOf("await generateReportPdfBytes(");
    const smsIndex = source.indexOf("await startAgentConversation({");

    expect(saveLeadIndex).toBeGreaterThan(-1);
    expect(renderIndex).toBeGreaterThan(-1);
    expect(smsIndex).toBeGreaterThan(-1);
    expect(saveLeadIndex).toBeLessThan(renderIndex);
    expect(renderIndex).toBeLessThan(smsIndex);
  });

  test("SMS failure does not block PDF response", async () => {
    mock.module("~/server/leads", () => ({
      saveLead: mock(async () => undefined),
    }));

    mock.module("~/server/speed2Lead/config", () => ({
      isSpeed2LeadEnabled: () => true,
    }));

    mock.module("~/server/speed2Lead/reportTokens", () => ({
      createReportToken: mock(async () => {
        throw new Error("redis down");
      }),
      buildReportUrl: mock(() => "https://624voice.com/report/token"),
    }));

    mock.module("~/server/speed2Lead/roiOpportunity", () => ({
      getPrimaryOpportunity: () => "Missed-Call Recovery",
    }));

    const { generateRoiPdfHandler } = await import(
      "~/server/generateRoiPdfHandler.server"
    );
    const result = await generateRoiPdfHandler({
      trade: "PestControl",
      truckCount: 15,
      monthlyCalls: 525,
      lead: {
        firstName: "Jordan",
        lastName: "Miller",
        businessName: "Northstar Pest Control",
        email: `workflow-sms-fail-${Date.now()}@example.com`,
        phone: "(555) 555-0198",
      },
      websiteOption: "none",
      smsConsent: true,
    });

    expect(result.base64).toBeTruthy();
  }, 120_000);

  test("report token route uses V2 PDF server handler", async () => {
    const routeSource = await Bun.file(`${import.meta.dir}/../routes/report/$token.ts`).text();
    const serveSource = await Bun.file(
      `${import.meta.dir}/report/serveReportTokenPdf.server.ts`,
    ).text();
    expect(routeSource).toContain("serveReportTokenPdf");
    expect(serveSource).toContain("renderReportPdf");
    expect(serveSource).not.toContain("fillRoiPdfTemplate");
  });
});
