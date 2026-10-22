import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildVideoRequest, startVideoSchema } from "./video-request";

const GATEWAY_URL = "https://ai.gateway.lovable.dev";
const BUCKET = "videos";

type JobStatus = "queued" | "in_progress" | "completed" | "failed";
export type VideoStatus = "generating" | "ready" | "failed";

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

function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const startVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => startVideoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const response = await fetch(`${GATEWAY_URL}/v1/videos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${requireKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildVideoRequest(data)),
    });
    if (!response.ok) {
      return { ok: false as const, error: await gatewayErrorMessage(response) };
    }
    const job = (await response.json()) as { id: string; status: JobStatus };

    // Rows and files are written server-side so users can't forge job ids or statuses.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("videos")
      .insert({
        user_id: context.userId,
        job_id: job.id,
        mode: data.mode,
        prompt: data.prompt,
        duration: data.duration,
        aspect_ratio: data.aspectRatio,
        status: "generating",
      })
      .select("id")
      .single();
    if (error || !row) {
      console.error("Could not save video row", error);
      return { ok: false as const, error: "Your video started but could not be saved to your account." };
    }

    // Cover picture for the library (reference photos aren't the opening frame, so skip them).
    const first = data.images[0];
    if (first && data.mode !== "reference") {
      const posterPath = `${context.userId}/${row.id}-poster.jpg`;
      const { error: upErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(posterPath, base64ToBytes(first.data), { contentType: first.mimeType, upsert: true });
      if (upErr) console.error("Poster upload failed", upErr);
      else await supabaseAdmin.from("videos").update({ poster_path: posterPath }).eq("id", row.id);
    }

    return { ok: true as const, id: row.id };
  });

/** Checks a saved video's job; when it finishes, copies the MP4 into the user's storage. */
export const syncVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // RLS: users can only read their own rows.
    const { data: row, error } = await context.supabase
      .from("videos")
      .select("id, user_id, job_id, status, error, storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) return { ok: false as const, transient: false, error: "Video not found." };

    if (row.status !== "generating") {
      return {
        ok: true as const,
        status: row.status as VideoStatus,
        progress: null,
        error: row.error,
        storagePath: row.storage_path,
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const markFailed = async (message: string) => {
      await supabaseAdmin
        .from("videos")
        .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      return {
        ok: true as const,
        status: "failed" as VideoStatus,
        progress: null,
        error: message,
        storagePath: null,
      };
    };

    const key = requireKey();
    const response = await fetch(`${GATEWAY_URL}/v1/videos/${encodeURIComponent(row.job_id)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (response.status === 404) {
      return markFailed("This video expired before it could be saved.");
    }
    if (!response.ok) {
      const transient = response.status === 429 || response.status >= 500;
      return { ok: false as const, transient, error: await gatewayErrorMessage(response) };
    }
    const job = (await response.json()) as {
      status: JobStatus;
      progress?: number;
      error?: { code?: string; message?: string };
    };

    if (job.status === "failed") {
      const blocked = job.error?.code === "moderation_blocked" || job.error?.code === "invalid_request";
      return markFailed(
        (job.error?.message ?? "The video could not be made.") +
          (blocked ? " One of the photos may be the cause — try different photos." : ""),
      );
    }

    if (job.status !== "completed") {
      return {
        ok: true as const,
        status: "generating" as VideoStatus,
        progress: typeof job.progress === "number" ? job.progress : null,
        error: null,
        storagePath: null,
      };
    }

    const content = await fetch(
      `${GATEWAY_URL}/v1/videos/${encodeURIComponent(row.job_id)}/content`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!content.ok) {
      console.error("Video download failed", content.status);
      return { ok: false as const, transient: true, error: "The video finished but could not be saved yet." };
    }
    const bytes = new Uint8Array(await content.arrayBuffer());
    const storagePath = `${row.user_id}/${row.id}.mp4`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
    if (upErr) {
      console.error("Video upload failed", upErr);
      return { ok: false as const, transient: true, error: "The video finished but could not be saved yet." };
    }
    await supabaseAdmin
      .from("videos")
      .update({ status: "ready", storage_path: storagePath, updated_at: new Date().toISOString() })
      .eq("id", row.id);

    return {
      ok: true as const,
      status: "ready" as VideoStatus,
      progress: 100,
      error: null,
      storagePath,
    };
  });
