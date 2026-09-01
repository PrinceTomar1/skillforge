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
    if (err.message) return err.message;
  }
  return "Something went wrong. Please try again.";
}
