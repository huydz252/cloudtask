import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import type { User } from "./types";
let accessToken: string | null = null;
export const setToken = (token: string | null) => {
  accessToken = token;
};
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";
export const api = axios.create({ baseURL: API_BASE_URL, withCredentials: true });
export const sessionApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});
api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
let refreshing: Promise<{ token: string; user: User }> | null = null;
export async function restoreSession() {
  if (!refreshing)
    refreshing = sessionApi
      .post("/auth/refresh", {})
      .then(({ data }) => {
        setToken(data.token);
        return data;
      })
      .finally(() => {
        refreshing = null;
      });
  return refreshing;
}
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      retried?: boolean;
    };
    if (error.response?.status === 401 && original && !original.retried) {
      original.retried = true;
      try {
        await restoreSession();
        return api(original);
      } catch {
        setToken(null);
        window.dispatchEvent(new Event("session-expired"));
      }
    }
    return Promise.reject(error);
  },
);
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    const fields = data?.errors?.fieldErrors;
    const first = fields ? Object.values(fields).flat()[0] : null;
    return first
      ? `${data.message} ${first}`
      : data?.message || "Không thể kết nối máy chủ. Kiểm tra mạng và API.";
  }
  return error instanceof Error ? error.message : "Đã xảy ra lỗi.";
}
