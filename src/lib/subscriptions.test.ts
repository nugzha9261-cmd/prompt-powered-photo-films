import { describe, expect, it } from "vitest";
import { premiumIsActive, revenueCatEventSchema, subscriptionCreditBalance, subscriptionEvent, type RevenueCatEvent } from "./subscriptions";

const event: RevenueCatEvent = {
  id: "event-1", type: "INITIAL_PURCHASE", app_user_id: "11111111-1111-4111-8111-111111111111",
  product_id: "cineflow_weekly", entitlement_ids: ["premium"], store: "APP_STORE", environment: "PRODUCTION",
  transaction_id: "payment-1", original_transaction_id: "subscription-1", event_timestamp_ms: 1_790_000_000_000,
  expiration_at_ms: 1_800_000_000_000, period_type: "NORMAL", price: 4.99,
};

describe("verified subscription payments", () => {
  it.each([["cineflow_weekly", 12], ["cineflow_monthly", 50], ["cineflow_quarterly", 180]])("grants %s its paid-period credits", (product, credits) => {
    expect(subscriptionEvent({ ...event, product_id: String(product) })?.credits).toBe(credits);
  });
  it("grants a paid renewal its allowance", () => expect(subscriptionEvent({ ...event, type: "RENEWAL" })?.credits).toBe(12));
  it("does not grant trial or zero-price purchase credits", () => {
    expect(subscriptionEvent({ ...event, period_type: "TRIAL" })?.credits).toBe(0);
    expect(subscriptionEvent({ ...event, price: 0 })?.credits).toBe(0);
    expect(subscriptionEvent({ ...event, is_family_share: true })?.credits).toBe(0);
  });
  it("does not award credits for restore-like, cancellation or transfer events", () => {
    expect(subscriptionEvent({ ...event, type: "CANCELLATION" })?.credits).toBe(0);
    expect(subscriptionEvent({ ...event, type: "TRANSFER" })).toBeNull();
    expect(subscriptionEvent({ ...event, type: "RESTORE" })).toBeNull();
  });
  it("rejects unknown products, entitlements, stores and anonymous identities", () => {
    expect(subscriptionEvent({ ...event, product_id: "invented" })).toBeNull();
    expect(subscriptionEvent({ ...event, entitlement_ids: ["other"] })).toBeNull();
    expect(subscriptionEvent({ ...event, store: "PLAY_STORE" })).toBeNull();
    expect(subscriptionEvent({ ...event, app_user_id: "$RCAnonymousID:abc" })).toBeNull();
  });
  it("isolates sandbox events unless explicitly enabled", () => {
    expect(subscriptionEvent({ ...event, environment: "SANDBOX" })).toBeNull();
    expect(subscriptionEvent({ ...event, environment: "SANDBOX" }, true)?.credits).toBe(12);
  });
  it("bounds event input", () => expect(revenueCatEventSchema.safeParse({ api_version: "1.0", event: { ...event, event_timestamp_ms: -1 } }).success).toBe(false));
});

describe("subscription policy", () => {
  it("carries unused paid credits over on renewal", () => expect(subscriptionCreditBalance(7, 50)).toBe(57));
  it("keeps credits after a refund", () => expect(subscriptionCreditBalance(37, 0, true)).toBe(37));
  it("ends premium access on refund even before expiration", () => {
    const refundEvent = { ...event, type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", price: -4.99 };
    expect(revenueCatEventSchema.safeParse({ api_version: "1.0", event: refundEvent }).success).toBe(true);
    const refund = subscriptionEvent(refundEvent);
    expect(refund?.revoked).toBe(true);
    expect(premiumIsActive("2030-01-01T00:00:00Z", refund?.revoked ?? false, 1_790_000_000_000)).toBe(false);
  });
  it("keeps access after ordinary cancellation until expiry", () => {
    expect(subscriptionEvent({ ...event, type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE" })?.revoked).toBe(false);
    expect(premiumIsActive("2030-01-01T00:00:00Z", false, 1_790_000_000_000)).toBe(true);
  });
  it("never keeps expired premium access", () => expect(premiumIsActive("2020-01-01T00:00:00Z", false, 1_790_000_000_000)).toBe(false));
});