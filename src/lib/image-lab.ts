import { z } from "zod";

/** Image Lab rules shared by the form and the server. */
export const CREDITS_PER_IMAGE_RUN = 1;
export const IMAGES_PER_RUN = 4;
export const MAX_IMAGE_PROMPT = 1000;
/** Base64 cap for a remix source photo (~6 MB of JPEG). */
export const MAX_SOURCE_BASE64 = 8_000_000;

export const IMAGE_SHAPES = {
  square: { label: "Square", size: "1024x1024" },
  portrait: { label: "Tall", size: "1024x1536" },
  landscape: { label: "Wide", size: "1536x1024" },
} as const;
export type ImageShape = keyof typeof IMAGE_SHAPES;

export const IMAGE_STYLES = [
  { id: "photo", label: "Photorealistic", hint: "photorealistic, natural light, sharp detail" },
  { id: "film", label: "35mm film", hint: "shot on 35mm film, soft grain, cinematic color" },
  { id: "anime", label: "Anime", hint: "anime illustration, clean line art, vivid colors" },
  { id: "pixar", label: "3D animated", hint: "3D animated movie style, soft lighting, expressive" },
  { id: "vintage", label: "Vintage", hint: "vintage photograph, faded warm tones" },
] as const;

export const generateImagesSchema = z.object({
  prompt: z.string().trim().min(3, "Describe the image you want.").max(MAX_IMAGE_PROMPT),
  shape: z.enum(["square", "portrait", "landscape"]),
  style: z.string().max(20).optional(),
  source: z.string().min(100).max(MAX_SOURCE_BASE64).optional(),
});
export type GenerateImagesInput = z.infer<typeof generateImagesSchema>;

export function buildImagePrompt(prompt: string, style?: string, remix = false) {
  const s = IMAGE_STYLES.find((x) => x.id === style);
  const base = remix ? `Recreate this photo: ${prompt.trim()}` : prompt.trim();
  return s ? `${base}. Style: ${s.hint}.` : base;
}

/** Key used to hand a chosen still from the Image Lab to the Studio. */
export const STUDIO_HANDOFF_KEY = "cineflow:studio-photo";
