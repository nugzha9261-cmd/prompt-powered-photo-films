import { describe, expect, it } from "vitest";
import { CREDITS_PER_EDIT, CREDITS_PER_VIDEO, FREE_SIGNUP_CREDITS, canAfford } from "./credits";

describe("credits", () => {
  it("new accounts get 2 free videos", () => {
    expect(FREE_SIGNUP_CREDITS / CREDITS_PER_VIDEO).toBe(2);
  });
  it("blocks generation at zero credits", () => {
    expect(canAfford(0, CREDITS_PER_VIDEO)).toBe(false);
    expect(canAfford(null, CREDITS_PER_VIDEO)).toBe(false);
  });
  it("allows generation with enough credits", () => {
    expect(canAfford(1, CREDITS_PER_EDIT)).toBe(true);
  });
});
