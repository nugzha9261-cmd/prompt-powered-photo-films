import { z } from "zod";

import { MAX_PROMPT_LENGTH, MIN_PROMPT_LENGTH, VIDEO_MODEL } from "./video-request";

// Client-safe rules for editing an existing clip. Shared by the form and the server.
export const EDIT_MIN_SECONDS = 3;
export const EDIT_MAX_SECONDS = 10;
export const EDIT_UPLOAD_MAX_SECONDS = 30;
export const EDIT_MAX_BYTES = 40 * 1024 * 1024; // keeps the base64 body under the gateway's 64 MiB cap
export const EDIT_MAX_BASE64_CHARS = Math.ceil(EDIT_MAX_BYTES / 3) * 4;
export const EDIT_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export type EditMime = (typeof EDIT_MIME_TYPES)[number];

/** The model needs the edit length to match the clip at 0.1s precision. */
export function roundDuration(seconds: number) {
  return Math.round(seconds * 10) / 10;
}

/** "video/webm;codecs=vp9" -> "video/webm"; unknown types -> null. */
export function normalizeMime(type: string): EditMime | null {
  const base = (type.split(";")[0] ?? "").trim().toLowerCase();
  return (EDIT_MIME_TYPES as readonly string[]).includes(base) ? (base as EditMime) : null;
}

export type CheckItem = { key: "format" | "size" | "duration"; ok: boolean; label: string; detail: string };

/** Pre-flight checklist shown as soon as a clip is picked. */
export function checkClip(clip: { mime: string; bytes: number; seconds: number }): CheckItem[] {
  const mime = normalizeMime(clip.mime);
  const mb = clip.bytes / (1024 * 1024);
  const s = roundDuration(clip.seconds);
  return [
    {
      key: "format",
      ok: mime !== null,
      label: mime ? `${(mime.split("/")[1] ?? "").toUpperCase().replace("QUICKTIME", "MOV")} file` : "Unsupported file",
      detail: mime ? "Supported format" : "Use an MP4, WebM or MOV video",
    },
    {
      key: "size",
      ok: clip.bytes <= EDIT_MAX_BYTES,
      label: `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`,
      detail: clip.bytes <= EDIT_MAX_BYTES ? "Under the 40 MB limit" : "Over 40 MB — trim it shorter",
    },
    {
      key: "duration",
      ok: s >= EDIT_MIN_SECONDS && s <= EDIT_MAX_SECONDS,
      label: `${s}s long`,
      detail:
        s < EDIT_MIN_SECONDS
          ? "Too short — needs at least 3 seconds"
          : s > EDIT_MAX_SECONDS
            ? "Over 10 seconds — pick a part to edit"
            : "Within the 3–10 second range",
    },
  ];
}

/** Equal sections avoid a final piece shorter than the model's 3-second minimum. */
export function editSections(seconds: number) {
  const ticks = Math.round(seconds * 10);
  if (!Number.isFinite(seconds) || seconds < EDIT_MIN_SECONDS || seconds > EDIT_UPLOAD_MAX_SECONDS) {
    throw new Error("Choose a video between 3 and 30 seconds.");
  }
  const count = Math.ceil(ticks / (EDIT_MAX_SECONDS * 10));
  return Array.from({ length: count }, (_, i) => {
    const start = Math.floor(i * ticks / count);
    const end = Math.floor((i + 1) * ticks / count);
    return { start: start / 10, seconds: (end - start) / 10 };
  });
}

export function checkUpload(clip: Parameters<typeof checkClip>[0]): CheckItem[] {
  return checkClip(clip).map((item) => item.key !== "duration" ? item : {
    ...item,
    ok: Number.isFinite(clip.seconds) && clip.seconds >= EDIT_MIN_SECONDS && clip.seconds <= EDIT_UPLOAD_MAX_SECONDS,
    detail: clip.seconds < EDIT_MIN_SECONDS ? "Needs at least 3 seconds"
      : clip.seconds > EDIT_UPLOAD_MAX_SECONDS ? "Over 30 seconds — pick a part to edit"
      : clip.seconds > EDIT_MAX_SECONDS ? `${editSections(clip.seconds).length} separately charged edits, joined into one video`
      : "Within the 3–30 second range",
  });
}

export const joinedEditSchema = z.object({
  ids: z.array(z.string().uuid()).min(2).max(3).refine(ids => new Set(ids).size === ids.length),
  data: z.string().min(100).max(EDIT_MAX_BASE64_CHARS).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});

export const editVideoSchema = z.object({
  video: z.object({
    data: z
      .string()
      .min(100, "Please add a video.")
      .max(EDIT_MAX_BASE64_CHARS, "That video is too large (max 40 MB).")
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, "The video could not be read."),
    mimeType: z.enum(EDIT_MIME_TYPES),
  }),
  seconds: z
    .number()
    .min(EDIT_MIN_SECONDS, "The clip needs to be at least 3 seconds.")
    .max(EDIT_MAX_SECONDS, "The clip can be at most 10 seconds.")
    .refine((n) => roundDuration(n) === n, "Clip length must be rounded to 0.1s."),
  prompt: z
    .string()
    .trim()
    .min(MIN_PROMPT_LENGTH, "Describe what should change.")
    .max(MAX_PROMPT_LENGTH, `Keep the description under ${MAX_PROMPT_LENGTH} characters.`),
  aspectRatio: z.enum(["16:9", "9:16"]),
});

export type EditVideoInput = z.infer<typeof editVideoSchema>;

export function buildEditPrompt(prompt: string) {
  return `Edit this video. ${prompt.trim()} Keep everything else the same — same motion, timing and camera.`;
}

export function buildEditRequest(input: EditVideoInput) {
  return {
    model: VIDEO_MODEL,
    input: [
      { type: "video", data: input.video.data, mime_type: input.video.mimeType },
      { type: "text", text: buildEditPrompt(input.prompt) },
    ],
    // Edits keep the source shape, so no aspect_ratio; duration must match the clip.
    response_format: { type: "video", resolution: "720p", duration: `${input.seconds}s` },
    generation_config: { video_config: { task: "edit" } },
  };
}
