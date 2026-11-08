import { describe, expect, it } from "vitest";

import { buildEditRequest, checkClip, checkUpload, editSections, editVideoSchema, normalizeMime, roundDuration, joinedEditSchema } from "./video-edit";

const MB = 1024 * 1024;
const base = {
  video: { data: "A".repeat(200), mimeType: "video/mp4" as const },
  seconds: 5.5,
  prompt: "Make the jacket yellow",
  aspectRatio: "16:9" as const,
};
const ok = (v: unknown) => editVideoSchema.safeParse(v).success;
const passed = (c: Parameters<typeof checkClip>[0]) =>
  Object.fromEntries(checkClip(c).map((i) => [i.key, i.ok])) as Record<"format" | "size" | "duration", boolean>;

describe("video edit rules", () => {
  it("accepts 30-second uploads but rejects longer videos", () => {
    expect(checkUpload({ mime: "video/mp4", bytes: MB, seconds: 30 }).every(c => c.ok)).toBe(true);
    expect(checkUpload({ mime: "video/mp4", bytes: MB, seconds: 30.01 }).every(c => c.ok)).toBe(false);
  });
  it("splits 30 seconds into three supported ten-second edits", () => {
    expect(editSections(30)).toEqual([{ start: 0, seconds: 10 }, { start: 10, seconds: 10 }, { start: 20, seconds: 10 }]);
  });
  it("balances sections rather than leaving a too-short last part", () => {
    expect(editSections(10.1)).toEqual([{ start: 0, seconds: 5 }, { start: 5, seconds: 5.1 }]);
    expect(() => editSections(30.1)).toThrow();
  });
  it("rejects duplicate sections when saving a joined edit", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(joinedEditSchema.safeParse({ ids: [id, id], data: "A".repeat(200) }).success).toBe(false);
  });
  it("rounds clip length to 0.1s", () => {
    expect(roundDuration(5.46)).toBe(5.5);
    expect(roundDuration(5.44)).toBe(5.4);
  });

  it("accepts clips of 3 to 10 seconds only", () => {
    expect(passed({ mime: "video/mp4", bytes: MB, seconds: 2.9 }).duration).toBe(false);
    expect(passed({ mime: "video/mp4", bytes: MB, seconds: 10 }).duration).toBe(true);
    expect(passed({ mime: "video/mp4", bytes: MB, seconds: 10.2 }).duration).toBe(false);
    expect(ok({ ...base, seconds: 11 })).toBe(false);
  });

  it("rejects files over 40 MB", () => {
    expect(passed({ mime: "video/mp4", bytes: 40 * MB, seconds: 5 }).size).toBe(true);
    expect(passed({ mime: "video/mp4", bytes: 40 * MB + 1, seconds: 5 }).size).toBe(false);
  });

  it("allows MP4, WebM and MOV only", () => {
    expect(normalizeMime("video/webm;codecs=vp9")).toBe("video/webm");
    expect(normalizeMime("video/quicktime")).toBe("video/quicktime");
    expect(normalizeMime("video/x-msvideo")).toBeNull();
  });

  it("rejects unrounded lengths", () => {
    expect(ok({ ...base, seconds: 5.46 })).toBe(false);
  });

  it("sends the clip's exact length and no shape", () => {
    const req = buildEditRequest(base);
    expect(req.response_format.duration).toBe("5.5s");
    expect("aspect_ratio" in req.response_format).toBe(false);
    expect(req.input[0]?.type).toBe("video");
  });
});
