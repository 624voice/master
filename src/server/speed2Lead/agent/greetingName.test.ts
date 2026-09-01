import { describe, expect, test } from "bun:test";
import { usableGreetingName } from "~/server/speed2Lead/agent/greetingName";

describe("usableGreetingName", () => {
  test("accepts ordinary names", () => {
    expect(usableGreetingName("Jamie")).toBe("Jamie");
    expect(usableGreetingName("Al")).toBe("Al");
    expect(usableGreetingName("Chris")).toBe("Chris");
    expect(usableGreetingName("  Alex  ")).toBe("Alex");
  });

  test("rejects empty, single-character, and digits-only values", () => {
    expect(usableGreetingName(undefined)).toBeUndefined();
    expect(usableGreetingName("")).toBeUndefined();
    expect(usableGreetingName(" ")).toBeUndefined();
    expect(usableGreetingName("d")).toBeUndefined();
    expect(usableGreetingName("A")).toBeUndefined();
    expect(usableGreetingName("123")).toBeUndefined();
    expect(usableGreetingName("0")).toBeUndefined();
  });

  test("rejects the exact placeholder list", () => {
    expect(usableGreetingName("test")).toBeUndefined();
    expect(usableGreetingName("TEST")).toBeUndefined();
    expect(usableGreetingName("asdf")).toBeUndefined();
    expect(usableGreetingName("n/a")).toBeUndefined();
    expect(usableGreetingName("na")).toBeUndefined();
    expect(usableGreetingName("none")).toBeUndefined();
    expect(usableGreetingName("xxx")).toBeUndefined();
  });

  test("does not reject names that merely contain a listed token", () => {
    expect(usableGreetingName("test 3")).toBe("test 3");
    expect(usableGreetingName("Natalie")).toBe("Natalie");
  });
});
