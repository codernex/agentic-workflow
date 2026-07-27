import { client } from "@repo/api-client";

// Determine API base URL dynamically or from environment variables
const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_ENGINE_URL) {
    return process.env.NEXT_PUBLIC_ENGINE_URL.replace(/\/api\/v1\/?$/, "");
  }
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/api\/v1\/?$/, "");
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.includes("codernex.dev")) {
      return `${window.location.protocol}//api-workflow.codernex.dev`;
    }
  }
  return "http://localhost:8000";
};

const getWsUrl = (): string => {
  if (process.env.NEXT_PUBLIC_ENGINE_WS_URL) {
    return process.env.NEXT_PUBLIC_ENGINE_WS_URL;
  }
  const base = getBaseUrl();
  return base.replace(/^http/, "ws");
};

export const ENGINE_BASE_URL = getBaseUrl();
export const ENGINE_WS_URL = getWsUrl();

// Set base URL for @repo/api-client
client.setConfig({
  baseUrl: ENGINE_BASE_URL,
});
