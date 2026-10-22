import { describe, expect, it } from "vitest";

import { aspectForSize, buildVideoRequest, startVideoSchema } from "./video-request";

const base = {
  imageBase64: "A".repeat(200),
  mimeType: "image/jpeg" as const,
  prompt: "Gentle wind moves the trees",
  duration: 8 as const,
  aspectRatio: "16:9" as const,
};

describe("video request rules", () => {
  it("requires a prompt", () => {
    expect(startVideoSchema.safeParse({ ...base, prompt: "  " }).success).toBe(false);
  });

  it("only allows 5, 8 or 10 second clips", () => {
    expect(startVideoSchema.safeParse({ ...base, duration: 7 }).success).toBe(false);
    expect(startVideoSchema.safeParse({ ...base, duration: 10 }).success).toBe(true);
  });

  it("rejects photos over ~10 MB", () => {
    expect(startVideoSchema.safeParse({ ...base, imageBase64: "A".repeat(14_000_004) }).success).toBe(
      false,
    );
  });

  it("sends the photo as the first frame with the chosen length", () => {
    const body = buildVideoRequest(startVideoSchema.parse(base));
    expect(body.input[0]).toMatchObject({ type: "image", mime_type: "image/jpeg" });
    expect(body.response_format.duration).toBe("8s");
    expect(body.response_format.aspect_ratio).toBe("16:9");
  });

  it("picks portrait for tall photos", () => {
    expect(aspectForSize(1080, 1920)).toBe("9:16");
    expect(aspectForSize(1920, 1080)).toBe("16:9");
  });
});
