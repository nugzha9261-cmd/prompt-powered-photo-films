import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { VIDEO_ID_PATTERN, buildVideoRequest, startVideoSchema } from "./video-request";

const GATEWAY_URL = "https://ai.gateway.lovable.dev";

type JobStatus = "queued" | "in_progress" | "completed" | "failed";

async function gatewayErrorMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  console.error("Video gateway error", response.status, body);
  if (response.status === 429) {
    return (
      body?.message ??
      "Too many videos are being made right now. Wait for the current one to finish, then try again."
    );
  }
  return body?.message ?? `The video service returned an error (${response.status}).`;
}

function requireKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("The video service is not configured.");
  return key;
}

export const startVideo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => startVideoSchema.parse(input))
  .handler(async ({ data }) => {
    const response = await fetch(`${GATEWAY_URL}/v1/videos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${requireKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildVideoRequest(data)),
    });
    if (!response.ok) {
      return { ok: false as const, error: await gatewayErrorMessage(response) };
    }
    const job = (await response.json()) as { id: string; status: JobStatus };
    return { ok: true as const, id: job.id, status: job.status };
  });

export const getVideoStatus = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().regex(VIDEO_ID_PATTERN) }).parse(input),
  )
  .handler(async ({ data }) => {
    const response = await fetch(`${GATEWAY_URL}/v1/videos/${encodeURIComponent(data.id)}`, {
      headers: { Authorization: `Bearer ${requireKey()}` },
    });
    if (!response.ok) {
      const transient = response.status === 429 || response.status >= 500;
      return { ok: false as const, transient, error: await gatewayErrorMessage(response) };
    }
    const job = (await response.json()) as {
      status: JobStatus;
      progress?: number;
      error?: { code?: string; message?: string };
    };
    return {
      ok: true as const,
      status: job.status,
      progress: typeof job.progress === "number" ? job.progress : null,
      error: job.error?.message ?? null,
      errorCode: job.error?.code ?? null,
    };
  });
