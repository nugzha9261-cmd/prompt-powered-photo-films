import { z } from "zod";
import type { OmniVideoFields } from "@lovable.dev/ai-gateway";

// Client-safe rules shared by the form and the server.
export const VIDEO_MODEL = "google/gemini-omni-1.1-flash";
export const DURATIONS = [5, 10] as const;
export const ASPECT_RATIOS = ["16:9", "9:16"] as const;
export const MAX_IMAGE_BASE64_CHARS = 14_000_000; // ~10 MB photo
export const MAX_TOTAL_BASE64_CHARS = 40_000_000; // keeps the request under the gateway cap
export const MIN_PROMPT_LENGTH = 3;
export const MAX_PROMPT_LENGTH = 1500;
export const MAX_CAPTION_LENGTH = 300;
export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

export const MODES = ["single", "first_last", "storyboard", "reference"] as const;
export type Mode = (typeof MODES)[number];

/** How many photos each mode takes. */
export const MODE_LIMITS: Record<Mode, { min: number; max: number }> = {
  single: { min: 1, max: 1 },
  first_last: { min: 2, max: 2 },
  storyboard: { min: 2, max: 4 },
  reference: { min: 1, max: 3 },
};

export type Duration = (typeof DURATIONS)[number];
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

const imageSchema = z.object({
  data: z
    .string()
    .min(100, "Please add a photo.")
    .max(MAX_IMAGE_BASE64_CHARS, "That photo is too large (max ~10 MB).")
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "The photo could not be read."),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  caption: z
    .string()
    .trim()
    .max(MAX_CAPTION_LENGTH, `Keep each scene note under ${MAX_CAPTION_LENGTH} characters.`)
    .optional(),
});

export const startVideoSchema = z
  .object({
    mode: z.enum(MODES),
    images: z.array(imageSchema).min(1, "Please add a photo.").max(4),
    prompt: z
      .string()
      .trim()
      .min(MIN_PROMPT_LENGTH, "Describe what should happen in the video.")
      .max(MAX_PROMPT_LENGTH, `Keep the description under ${MAX_PROMPT_LENGTH} characters.`),
    duration: z.union([z.literal(5), z.literal(10)]),
    aspectRatio: z.enum(ASPECT_RATIOS),
  })
  .superRefine((v, ctx) => {
    const { min, max } = MODE_LIMITS[v.mode];
    if (v.images.length < min || v.images.length > max) {
      ctx.addIssue({
        code: "custom",
        path: ["images"],
        message:
          min === max
            ? `This mode needs exactly ${min} photo${min > 1 ? "s" : ""}.`
            : `This mode needs ${min} to ${max} photos.`,
      });
    }
    const total = v.images.reduce((sum, img) => sum + img.data.length, 0);
    if (total > MAX_TOTAL_BASE64_CHARS) {
      ctx.addIssue({ code: "custom", path: ["images"], message: "These photos are too large together." });
    }
  });

export type StartVideoInput = z.infer<typeof startVideoSchema>;

export function aspectForSize(width: number, height: number): AspectRatio {
  return height > width ? "9:16" : "16:9";
}

/** Splits a clip into equal, whole-second-ish time windows, one per scene. */
export function sceneWindows(duration: number, scenes: number) {
  const step = duration / scenes;
  const fmt = (n: number) => String(Math.round(n * 10) / 10);
  return Array.from({ length: scenes }, (_, i) => `[${fmt(i * step)}-${fmt((i + 1) * step)}s]`);
}

const QUALITY = "Consider micro-detail, expression and timing.";

export function buildPromptText(input: StartVideoInput): string {
  const { mode, images, prompt } = input;
  const note = (i: number) => (images[i]?.caption ? ` ${images[i]?.caption}` : "");

  switch (mode) {
    case "single":
      return (
        `Animate this photo <FIRST_FRAME>, using it as the exact opening frame. ${prompt} ` +
        `Keep the people, objects and setting faithful to the photo. ${QUALITY}`
      );
    case "first_last":
      return (
        `[# Sources <FIRST_FRAME>@Image1, <LAST_FRAME>@Image2] ` +
        `The video opens exactly on <FIRST_FRAME> and ends exactly on <LAST_FRAME>, ` +
        `moving between them smoothly in a single continuous shot. ${prompt} ${QUALITY}`
      );
    case "storyboard": {
      // Images are sent as [first, last, ...middle] (see orderedImages), so the
      // first two parts are the frame anchors and the rest are references.
      const n = images.length;
      const windows = sceneWindows(input.duration, n);
      const refs = images
        .slice(1, -1)
        .map((_, i) => `<IMAGE_REF_${i}>@Image${i + 3}`)
        .join(", ");
      const beats = images.map((_, i) => {
        if (i === 0) return `${windows[i]} Scene 1 opens exactly on <FIRST_FRAME>.${note(i)}`;
        if (i === n - 1)
          return `${windows[i]} Final scene, ending exactly on <LAST_FRAME>.${note(i)}`;
        return `${windows[i]} Scene ${i + 1} moves into the setting of <IMAGE_REF_${i - 1}>.${note(i)}`;
      });
      return (
        `[# Sources <FIRST_FRAME>@Image1, <LAST_FRAME>@Image2]` +
        (refs ? ` [# References ${refs}]` : "") +
        ` One video that moves through these scenes in this order, with natural transitions, ` +
        `and the very last frame is <LAST_FRAME>. ${beats.join(" ")} Overall: ${prompt} ${QUALITY}`
      );
    }
    case "reference": {
      const refs = images.map((_, i) => `<IMAGE_REF_${i}>@Image${i + 1}`).join(", ");
      return (
        `[# References ${refs}] Use these photos as references for the people, objects and look — ` +
        `not as the opening frame. ${prompt} Keep everyone and everything from the references recognizable. ${QUALITY}`
      );
    }
  }
}

const TASK: Partial<Record<Mode, "image_to_video" | "reference_to_video">> = {
  single: "image_to_video",
  reference: "reference_to_video",
};

/** Order the photos are sent in. Storyboards send [first, last, ...middle scenes]. */
export function orderedImages(input: StartVideoInput) {
  const { mode, images } = input;
  if (mode !== "storyboard" || images.length < 3) return images;
  const first = images[0];
  const last = images[images.length - 1];
  if (!first || !last) return images;
  return [first, last, ...images.slice(1, -1)];
}

export function buildVideoRequest(input: StartVideoInput) {
  const task = TASK[input.mode];
  return {
    model: VIDEO_MODEL,
    input: [
      ...orderedImages(input).map((img) => ({ type: "image" as const, data: img.data, mime_type: img.mimeType })),
      { type: "text" as const, text: buildPromptText(input) },
    ],
    response_format: {
      type: "video",
      resolution: "720p",
      duration: `${input.duration}s`,
      aspect_ratio: input.aspectRatio,
    },
    ...(task ? { generation_config: { video_config: { task } } } : {}),
  } satisfies OmniVideoFields & { model: typeof VIDEO_MODEL };
}
