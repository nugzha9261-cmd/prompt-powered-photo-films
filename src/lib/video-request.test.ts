import { describe, expect, it } from "vitest";

import {
  aspectForSize,
  buildPromptText,
  buildVideoRequest,
  sceneWindows,
  startVideoSchema,
} from "./video-request";

const photo = (tag = "A") => ({ data: tag.repeat(200), mimeType: "image/jpeg" as const });

const base = {
  mode: "single" as const,
  images: [photo()],
  prompt: "Gentle wind moves the trees",
  duration: 5 as const,
  aspectRatio: "16:9" as const,
};

const ok = (v: unknown) => startVideoSchema.safeParse(v).success;

describe("video request rules", () => {
  it("requires a prompt", () => {
    expect(ok({ ...base, prompt: "  " })).toBe(false);
  });

  it("only allows 5 or 10 second clips", () => {
    expect(ok({ ...base, duration: 8 })).toBe(false);
    expect(ok({ ...base, duration: 5 })).toBe(true);
    expect(ok({ ...base, duration: 10 })).toBe(true);
  });

  it("rejects photos over ~10 MB", () => {
    expect(ok({ ...base, images: [{ ...photo(), data: "A".repeat(14_000_004) }] })).toBe(false);
  });

  it("one-photo mode takes exactly one photo", () => {
    expect(ok({ ...base, images: [photo(), photo()] })).toBe(false);
  });

  it("first → last mode takes exactly two photos", () => {
    expect(ok({ ...base, mode: "first_last", images: [photo()] })).toBe(false);
    expect(ok({ ...base, mode: "first_last", images: [photo(), photo()] })).toBe(true);
    expect(ok({ ...base, mode: "first_last", images: [photo(), photo(), photo()] })).toBe(false);
  });

  it("storyboard takes 2 to 4 scenes", () => {
    expect(ok({ ...base, mode: "storyboard", images: [photo()] })).toBe(false);
    expect(ok({ ...base, mode: "storyboard", images: [photo(), photo(), photo(), photo()] })).toBe(true);
    expect(ok({ ...base, mode: "storyboard", images: Array(5).fill(photo()) })).toBe(false);
  });

  it("reference mode takes 1 to 3 photos", () => {
    expect(ok({ ...base, mode: "reference", images: [photo()] })).toBe(true);
    expect(ok({ ...base, mode: "reference", images: Array(4).fill(photo()) })).toBe(false);
  });

  it("sends the photo as the first frame with the chosen length", () => {
    const body = buildVideoRequest(startVideoSchema.parse(base));
    expect(body.input[0]).toMatchObject({ type: "image", mime_type: "image/jpeg" });
    expect(body.response_format.duration).toBe("5s");
    expect(body.response_format.aspect_ratio).toBe("16:9");
  });

  it("storyboard sends first and last scenes before the middle scenes", () => {
    const input = startVideoSchema.parse({
      ...base,
      mode: "storyboard",
      images: [photo("F"), photo("M"), photo("L")],
    });
    const body = buildVideoRequest(input);
    const order = body.input.slice(0, 3).map((p) => ("data" in p ? p.data[0] : ""));
    expect(order).toEqual(["F", "L", "M"]);
    expect(buildPromptText(input)).toContain("<LAST_FRAME>@Image2");
  });

  it("reference photos are not used as the opening frame", () => {
    const input = startVideoSchema.parse({ ...base, mode: "reference", images: [photo()] });
    expect(buildVideoRequest(input).generation_config?.video_config.task).toBe("reference_to_video");
    expect(buildPromptText(input)).not.toContain("<FIRST_FRAME>");
  });

  it("splits the clip into one time window per scene", () => {
    expect(sceneWindows(10, 2)).toEqual(["[0-5s]", "[5-10s]"]);
  });

  it("picks portrait for tall photos", () => {
    expect(aspectForSize(1080, 1920)).toBe("9:16");
    expect(aspectForSize(1920, 1080)).toBe("16:9");
  });
  it("preserves the existing HD resolution and model for both durations", () => {
    for (const duration of [5, 10]) {
      const body = buildVideoRequest(startVideoSchema.parse({ ...base, duration }));
      expect(body.model).toBe("google/gemini-omni-1.1-flash");
      expect(body.response_format.resolution).toBe("720p");
      expect(body.response_format.duration).toBe(`${duration}s`);
    }
  });
});
