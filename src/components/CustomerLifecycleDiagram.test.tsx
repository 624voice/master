import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import {
  LIFECYCLE_HEADLINE,
  LIFECYCLE_NOTE,
  LIFECYCLE_STAGES,
} from "~/components/CustomerLifecycleDiagram";

const REPO_ROOT = join(import.meta.dirname, "../..");
const APPROVED_PNG_HASH =
  "ca710e111e59a4c8aa0c219290b902a85613e9cbd2b13d532205d4a8e250bbeb";

describe("CustomerLifecycleDiagram additional tests", () => {
  test("X-LIFECYCLE-01: six stage label pairs match approved verbatim list", () => {
    expect(LIFECYCLE_STAGES).toEqual([
      { boxLabel: "Found", dimensionLabel: "GET FOUND" },
      { boxLabel: "Responded To", dimensionLabel: "RESPOND" },
      { boxLabel: "Converted", dimensionLabel: "CONVERT" },
      { boxLabel: "Served and Retained", dimensionLabel: "RETAIN AND GROW" },
      { boxLabel: "Operated Efficiently", dimensionLabel: "REDUCE MANUAL WORK" },
      { boxLabel: "Measured and Improved", dimensionLabel: "MEASURE AND IMPROVE" },
    ]);
  });

  test("X-LIFECYCLE-02: headline and note are em-dash-free", () => {
    expect(LIFECYCLE_HEADLINE).not.toMatch(/[\u2013\u2014]/);
    expect(LIFECYCLE_NOTE).not.toMatch(/[\u2013\u2014]/);
    expect(LIFECYCLE_HEADLINE).toBe(
      "Six stages. One connected system moves a customer through all of them. Not every customer needs every capability.",
    );
    expect(LIFECYCLE_NOTE).toBe(
      "The AI Tool Assessment lives inside the paid Diagnostic. It is not a public lifecycle stage.",
    );
  });

  test("X-LIFECYCLE-03: reference PNG hash matches approved asset identity", () => {
    const pngPath = join(REPO_ROOT, "public/diagram-v3-lifecycle.png");
    const bytes = readFileSync(pngPath);
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(hash).toBe(APPROVED_PNG_HASH);
    expect(bytes.length).toBe(106_051);
  });

  test("X-LIFECYCLE-05: reference PNG is RGBA with actual alpha transparency", () => {
    const pngPath = join(REPO_ROOT, "public/diagram-v3-lifecycle.png");
    const bytes = readFileSync(pngPath);

    expect(bytes.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      true,
    );

    const ihdrLength = bytes.readUInt32BE(8);
    expect(bytes.slice(12, 16).toString("ascii")).toBe("IHDR");
    expect(ihdrLength).toBe(13);

    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    const bitDepth = bytes[24];
    const colorType = bytes[25];

    expect(width).toBe(2500);
    expect(height).toBe(760);
    expect(bitDepth).toBe(8);
    expect(colorType).toBe(6);

    const idatParts: Buffer[] = [];
    let offset = 8;
    while (offset < bytes.length) {
      const length = bytes.readUInt32BE(offset);
      offset += 4;
      const type = bytes.slice(offset, offset + 4).toString("ascii");
      offset += 4;
      const chunk = bytes.slice(offset, offset + length);
      offset += length + 4;
      if (type === "IDAT") {
        idatParts.push(chunk);
      }
      if (type === "IEND") {
        break;
      }
    }

    const raw = inflateSync(Buffer.concat(idatParts));
    const stride = 1 + width * 4;
    let nonOpaque = 0;
    for (let row = 0; row < height; row += 1) {
      const start = row * stride + 1;
      const rowData = raw.subarray(start, start + width * 4);
      for (let col = 3; col < rowData.length; col += 4) {
        if (rowData[col]! < 255) {
          nonOpaque += 1;
        }
      }
    }

    expect(nonOpaque).toBeGreaterThan(0);
  });

  test("X-LIFECYCLE-04: component source uses semantic ol/li structure", () => {
    const source = readFileSync(
      join(REPO_ROOT, "src/components/CustomerLifecycleDiagram.tsx"),
      "utf8",
    );
    expect(source).toContain("<ol");
    expect(source).toContain("<figure");
    expect(source).not.toMatch(/<img[^>]+diagram-v3-lifecycle/);
  });
});
