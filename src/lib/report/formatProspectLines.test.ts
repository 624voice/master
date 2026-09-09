import { describe, expect, test } from "bun:test";
import { formatPreparedForLine } from "~/lib/report/formatProspectLines";

describe("formatPreparedForLine", () => {
  test("includes business name when present", () => {
    expect(
      formatPreparedForLine({
        firstName: "Jordan",
        lastName: "Miller",
        businessName: "Northstar Pest Control",
        email: "j@example.com",
        phone: "555-0100",
      }),
    ).toBe("Prepared for Jordan Miller · Northstar Pest Control");
  });

  test("omits business name when missing", () => {
    expect(
      formatPreparedForLine({
        firstName: "Jordan",
        lastName: "Miller",
        businessName: "",
        email: "j@example.com",
        phone: "555-0100",
      }),
    ).toBe("Prepared for Jordan Miller");
  });

  test("omits business name when only one character", () => {
    expect(
      formatPreparedForLine({
        firstName: "Jordan",
        lastName: "Miller",
        businessName: "d",
        email: "j@example.com",
        phone: "555-0100",
      }),
    ).toBe("Prepared for Jordan Miller");
  });

  test("renders first name alone when last name missing", () => {
    expect(
      formatPreparedForLine({
        firstName: "Jordan",
        lastName: "",
        businessName: "Northstar Pest Control",
        email: "j@example.com",
        phone: "555-0100",
      }),
    ).toBe("Prepared for Jordan · Northstar Pest Control");
  });
});
