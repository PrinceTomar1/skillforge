import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Badge, Button, EmptyState, ProgressBar } from "./ui";

describe("ProgressBar", () => {
  it("clamps values above 100 to a full-width bar", () => {
    const { container } = render(<ProgressBar value={140} />);
    const fill = container.querySelector("[style]") as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });

  it("clamps negative values to 0", () => {
    const { container } = render(<ProgressBar value={-20} />);
    const fill = container.querySelector("[style]") as HTMLElement;
    expect(fill.style.width).toBe("0%");
  });
});

describe("Button", () => {
  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    fireEvent.click(screen.getByText("Click me"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled and does not fire onClick while isLoading", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} isLoading>
        Submit
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge tone="green">Published</Badge>);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="No courses yet" description="Enroll to get started." />);
    expect(screen.getByText("No courses yet")).toBeInTheDocument();
    expect(screen.getByText("Enroll to get started.")).toBeInTheDocument();
  });
});
