import { describe, expect, it } from "vitest";
import { slugify } from "../../src/utils/slugify";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Full-Stack Web Development")).toBe("full-stack-web-development");
  });

  it("strips punctuation", () => {
    expect(slugify("Node.js & Express!")).toBe("nodejs-express");
  });

  it("collapses repeated hyphens", () => {
    expect(slugify("A   B---C")).toBe("a-b-c");
  });

  it("trims surrounding whitespace before slugifying", () => {
    expect(slugify("  Machine Learning  ")).toBe("machine-learning");
  });
});
