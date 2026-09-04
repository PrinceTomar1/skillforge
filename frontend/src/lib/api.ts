import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});

export interface ApiErrorPayload {
  error: string;
  details?: Array<{ path: string; message: string }>;
}

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorPayload | undefined;
    if (data?.details?.length) return data.details.map((d) => d.message).join(" ");
    if (data?.error) return data.error;
    // No response at all (timeout, dropped connection, DNS) reads to a user
    // as "it said my password was wrong" if we show a generic message here
    // — the free-tier API host sleeps after 15 min idle, and the first
    // request after that can be slow enough to time out. Say that plainly
    // instead of a vague failure so a retry looks worth doing.
    if (!err.response) {
      return "Couldn't reach the server. The demo API sleeps when idle and can take up to a minute to wake up on the first request — please try again.";
    }
    if (err.message) return err.message;
  }
  return "Something went wrong. Please try again.";
}
