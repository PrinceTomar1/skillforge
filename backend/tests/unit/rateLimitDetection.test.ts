import { describe, expect, it } from "vitest";
import { isRateLimitError } from "../../src/services/ai/llmProvider";

describe("isRateLimitError", () => {
  it("recognizes a 429 status on a thrown SDK error (Anthropic and Gemini both expose this)", () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError(Object.assign(new Error("quota exceeded"), { status: 429 }))).toBe(true);
  });

  it("does not misclassify other error statuses as a rate limit", () => {
    expect(isRateLimitError({ status: 500 })).toBe(false);
    expect(isRateLimitError({ status: 404 })).toBe(false);
  });

  it("does not throw or misclassify on malformed input", () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(isRateLimitError("plain string error")).toBe(false);
    expect(isRateLimitError({})).toBe(false);
  });
});
