# Runtime path parity — renderReportPdf

## generateRoiPdf (calculator POST)

`src/components/RoiCalculator.tsx` → `generateRoiPdf()` (`src/server/generateRoiPdf.ts`)
→ `generateRoiPdfHandler()` (`src/server/generateRoiPdfHandler.server.ts`)
→ `generateReportPdfBytes()` (`src/server/report/generateReportPdfBytes.server.ts`)
→ `renderReportPdf()` (`src/server/report/renderReportPdf.server.ts`)

## GET /report/$token

`src/routes/report/$token.ts` → `serveReportTokenPdf()` (`src/server/report/serveReportTokenPdf.server.ts`)
→ `renderReportPdf()` (`src/server/report/renderReportPdf.server.ts`)
