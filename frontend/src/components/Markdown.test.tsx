import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders bold text without leaving ** markers visible", () => {
    const { container } = render(<Markdown text="This is **important** to know." />);
    expect(container.querySelector("strong")?.textContent).toBe("important");
    expect(container.textContent).not.toContain("**");
  });

  it("renders italic text without leaving * markers visible", () => {
    const { container } = render(<Markdown text="This is *emphasized* text." />);
    expect(container.querySelector("em")?.textContent).toBe("emphasized");
    expect(container.textContent).not.toMatch(/(?<!\w)\*(?!\*)/);
  });

  it("renders a bullet list as an actual <ul>, not literal asterisks", () => {
    const { container } = render(<Markdown text={"* First point\n* Second point"} />);
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe("First point");
    expect(items[1].textContent).toBe("Second point");
  });

  it("renders a markdown heading as styled text, not a literal ### prefix", () => {
    const { container } = render(<Markdown text={"### Why This Matters"} />);
    expect(container.textContent).toBe("Why This Matters");
    expect(container.textContent).not.toContain("#");
  });

  it("renders a horizontal rule line as an <hr>, not literal dashes", () => {
    const { container } = render(<Markdown text={"Some text\n\n---\n\nMore text"} />);
    expect(container.querySelector("hr")).not.toBeNull();
    expect(container.textContent).not.toContain("---");
  });

  it("renders plain paragraphs unchanged when there's no markdown", () => {
    const { container } = render(<Markdown text="Just a normal sentence." />);
    expect(container.textContent).toBe("Just a normal sentence.");
  });
});
