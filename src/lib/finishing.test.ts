import { describe, expect, it } from "vitest";
import { movieLengthOk, movieSchema, needsWatermark, voiceoverSchema } from "./finishing";

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
describe("mini-movies", () => {
  it("needs at least 2 scenes", () => expect(movieLengthOk([10])).toBe(false));
  it("allows 6 scenes up to 60 seconds", () => expect(movieLengthOk([10, 10, 10, 10, 10, 10])).toBe(true));
  it("rejects more than 6 scenes", () => expect(movieLengthOk([5, 5, 5, 5, 5, 5, 5])).toBe(false));
  it("rejects over 60 seconds", () => expect(movieLengthOk([10, 10, 10, 10, 10, 10.5])).toBe(false));
  it("rejects the same film twice", () =>
    expect(movieSchema.safeParse({ ids: [id(1), id(1)], data: "A".repeat(200) }).success).toBe(false));
});
describe("voiceover", () => {
  it("rejects scripts over 600 characters", () =>
    expect(voiceoverSchema.safeParse({ script: "a".repeat(601), voice: "Kore" }).success).toBe(false));
  it("accepts a known voice", () =>
    expect(voiceoverSchema.safeParse({ script: "Hello there", voice: "Charon" }).success).toBe(true));
});
describe("watermark", () => {
  it("marks free exports", () => expect(needsWatermark(false)).toBe(true));
  it("leaves paid exports clean", () => expect(needsWatermark(true)).toBe(false));
});
