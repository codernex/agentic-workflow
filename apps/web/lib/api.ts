import { client } from "@repo/api-client";

// Set base URL for FastAPI engine (without /api/v1 since openapi paths already include /api/v1)
client.setConfig({
  baseUrl: process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:8000",
});

export const ENGINE_BASE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:8000";
export const ENGINE_WS_URL = process.env.NEXT_PUBLIC_ENGINE_WS_URL || "ws://localhost:8000";
