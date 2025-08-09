import { describe, it, expect } from "vitest";
import { normalizeUrl } from "./normalizeUrl";

describe("normalizeUrl", () => {
  it("removes hash from url", () => {
    expect(normalizeUrl("https://a.com/p#x")).toBe("https://a.com/p");
  });
});
