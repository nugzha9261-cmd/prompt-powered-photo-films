import { z } from "zod";

// Client-safe rules shared by the form and the server.
export const VIDEO_MODEL = "google/gemini-omni-1.1-flash";
export const DURATIONS = [5, 8, 10] as const;
export const ASPECT_RATIOS = ["16:9", "9:16"] as const;
export const MAX_IMAGE_BASE64_CHARS = 14_000_000; // ~10 MB photo
export const MIN_PROMPT_LENGTH = 3;
export const MAX_PROMPT_LENGTH = 1500;
export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

export type Duration = (typeof DURATIONS)[number];
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const startVideoSchema = z.object({
  imageBase64: z
    .string()
    .min(100, "Please add a photo.")
    .max(MAX_IMAGE_BASE64_CHARS, "That photo is too large (max ~10 MB).")
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "The photo could not be read."),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  prompt: z
    .string()
    .trim()
    .min(MIN_PROMPT_LENGTH, "Describe how the photo should move.")
    .max(MAX_PROMPT_LENGTH, `Keep the description under ${MAX_PROMPT_LENGTH} characters.`),
  duration: z.union([z.literal(5), z.literal(8), z.literal(10)]),
  aspectRatio: z.enum(ASPECT_RATIOS),
});

export type StartVideoInput = z.infer<typeof startVideoSchema>;

export function aspectForSize(width: number, height: number): AspectRatio {
  return height > width ? "9:16" : "16:9";
}

export function buildVideoRequest(input: StartVideoInput) {
  return {
    model: VIDEO_MODEL,
    input: [
      { type: "image", data: input.imageBase64, mime_type: input.mimeType },
      {
        type: "text",
        text:
          `Animate this photo <FIRST_FRAME>, using it as the exact opening frame. ` +
          `${input.prompt} ` +
          `Keep the people, objects and setting faithful to the photo. Consider micro-detail, expression and timing.`,
      },
    ],
    response_format: {
      type: "video",
      resolution: "720p",
      duration: `${input.duration}s`,
      aspect_ratio: input.aspectRatio,
    },
    generation_config: { video_config: { task: "image_to_video" } },
  };
}
