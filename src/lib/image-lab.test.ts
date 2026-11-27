import { describe, expect, it } from "vitest";
import { CREDITS_PER_IMAGE_RUN, IMAGES_PER_RUN, buildImagePrompt, generateImagesSchema } from "./image-lab";

describe("image lab rules", () => {
  it("one credit buys one image", () => {
    expect(CREDITS_PER_IMAGE_RUN).toBe(1);
    expect(IMAGES_PER_RUN).toBe(1);
  });
  it("rejects empty prompts and unknown shapes", () => {
    expect(generateImagesSchema.safeParse({ prompt: " ", shape: "square" }).success).toBe(false);
    expect(generateImagesSchema.safeParse({ prompt: "a puppy", shape: "huge" }).success).toBe(false);
    expect(generateImagesSchema.safeParse({ prompt: "a puppy", shape: "portrait" }).success).toBe(true);
  });
  it("adds the chosen style and remix wording", () => {
    expect(buildImagePrompt("a cat", "anime", true)).toBe("Recreate this photo: a cat. Style: anime illustration, clean line art, vivid colors.");
    expect(buildImagePrompt("a cat")).toBe("a cat");
  });
});
