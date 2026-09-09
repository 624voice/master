import { createServerFn } from "@tanstack/react-start";
import type { LeadInfo } from "~/lib/lead/validateLead";
import type { TradeKey } from "~/lib/roi/roiModel";

export type PdfRequest = {
  trade: TradeKey;
  truckCount: number;
  monthlyCalls: number;
  lead: LeadInfo;
  websiteOption: "has" | "none";
  website?: string;
  smsConsent: boolean;
};

export const generateRoiPdf = createServerFn({ method: "POST" })
  .validator((data: PdfRequest) => data)
  .handler(async ({ data }) => {
    const { generateRoiPdfHandler } = await import(
      "~/server/generateRoiPdfHandler.server"
    );
    return generateRoiPdfHandler(data);
  });
