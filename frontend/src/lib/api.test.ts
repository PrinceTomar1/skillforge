import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { getErrorMessage } from "./api";

function makeAxiosError(data: unknown, status = 400) {
  return new AxiosError("Request failed", String(status), undefined, undefined, {
    status,
    statusText: "Bad Request",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  });
}

describe("getErrorMessage", () => {
  it("joins zod-style validation details into one message", () => {
    const err = makeAxiosError({
      error: "Validation failed",
      details: [
        { path: "email", message: "Enter a valid email address" },
        { path: "password", message: "Password must be at least 8 characters" },
      ],
    });
    expect(getErrorMessage(err)).toBe("Enter a valid email address Password must be at least 8 characters");
  });

  it("falls back to the top-level error string when there are no details", () => {
    const err = makeAxiosError({ error: "An account with this email already exists." }, 409);
    expect(getErrorMessage(err)).toBe("An account with this email already exists.");
  });

  it("returns a generic message for a non-axios error, rather than leaking internals", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("Something went wrong. Please try again.");
    expect(getErrorMessage("not an error object")).toBe("Something went wrong. Please try again.");
  });
});
