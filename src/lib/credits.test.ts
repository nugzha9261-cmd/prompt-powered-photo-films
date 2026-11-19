import { describe, expect, it } from "vitest";
import { CREDITS_PER_EDIT, CREDITS_PER_VIDEO, FREE_SIGNUP_CREDITS, canAfford, SUBSCRIPTION_PLANS } from "./credits";

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
  it("offers weekly, monthly and 3-month plans", () => {
    expect(SUBSCRIPTION_PLANS.map((p) => [p.price, p.credits])).toEqual([
      ["$4.99", 12],
      ["$14.99", 50],
      ["$34.99", 180],
    ]);
  });
});

import { dailyClaimWait } from "./credits";
describe("daily free video", () => {
  const now = Date.parse("2026-11-19T12:00:00Z");
  it("is available when never claimed", () => expect(dailyClaimWait(null, now)).toBe(0));
  it("waits 24 hours after a claim", () =>
    expect(dailyClaimWait("2026-11-19T06:00:00Z", now)).toBe(18 * 3600_000));
  it("is available again after 24 hours", () => expect(dailyClaimWait("2026-11-18T11:00:00Z", now)).toBe(0));
});
