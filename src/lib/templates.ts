import type { Duration } from "./video-request";

export type StyleTemplate = { id: string; label: string; hint: string; prompt: string; duration: Duration };

/** One-tap styles for the Studio; each fills the prompt and length. */
export const STYLE_TEMPLATES: StyleTemplate[] = [
  { id: "old-photo", label: "Old photo comes alive", hint: "Faces blink, smile, breathe", duration: 5,
    prompt: "The people in this old photograph come gently to life: they blink, breathe and softly smile at the camera, subtle film grain, warm nostalgic light, slow push-in, quiet piano" },
  { id: "product-orbit", label: "360° product orbit", hint: "Clean studio spin", duration: 8,
    prompt: "The camera smoothly orbits 360 degrees around the product on a clean studio surface, soft key light with crisp reflections, shallow depth of field, modern minimal music" },
  { id: "super8", label: "Vintage Super-8", hint: "Home-movie feel", duration: 8,
    prompt: "Shot on vintage Super-8 film: gentle handheld sway, light leaks, flickering exposure, faded warm colors, the scene moves naturally, soft projector whir" },
  { id: "drone", label: "Hollywood drone", hint: "Epic rising reveal", duration: 10,
    prompt: "A dramatic cinematic drone shot rises and pulls back to reveal the full scene, sweeping epic scale, golden-hour light, powerful orchestral score" },
  { id: "neon", label: "Cyberpunk neon", hint: "Rain and city glow", duration: 5,
    prompt: "Transform the scene into a rainy cyberpunk night: glowing neon signs reflect in wet surfaces, light rain falls, slow dolly forward, deep synth soundtrack" },
];
