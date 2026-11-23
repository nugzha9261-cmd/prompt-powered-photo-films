import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleRevenueCatWebhook, validWebhookAuthorization } from "./revenuecat-webhook.server";

const backend = vi.hoisted(() => ({
  user: vi.fn(), apply: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { auth: { admin: { getUserById: backend.user } }, rpc: backend.apply },
}));
const config = { authorization: "unit-test-authorization", allowSandbox: false };
const event = {
  id: "receipt-test", type: "INITIAL_PURCHASE", app_user_id: "11111111-1111-4111-8111-111111111111",
  product_id: "cineflow_weekly", entitlement_ids: ["premium"], store: "APP_STORE", environment: "PRODUCTION",
  transaction_id: "payment-test", original_transaction_id: "subscription-test",
  event_timestamp_ms: 1_790_000_000_000, expiration_at_ms: 1_800_000_000_000, price: 4.99, period_type: "NORMAL",
};
function request(body: unknown, authorization = config.authorization) {
  return new Request("https://cineflow.adsai.studio/api/public/revenuecat", {
    method: "POST", headers: { authorization }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  backend.user.mockResolvedValue({ data: { user: { id: event.app_user_id } }, error: null });
  backend.apply.mockResolvedValue({ data: "processed", error: null });
});
describe("payment webhook boundary", () => {
  it("fails closed when payment setup is missing", async () => {
    expect((await handleRevenueCatWebhook(request({}), { ...config, authorization: "" })).status).toBe(401);
    const anonymous = new Request("https://cineflow.adsai.studio/api/public/revenuecat", { method: "POST", body: "{}" });
    expect((await handleRevenueCatWebhook(anonymous, { ...config, authorization: "" })).status).toBe(401);
    expect(backend.user).not.toHaveBeenCalled();
    expect(backend.apply).not.toHaveBeenCalled();
  });
  it("rejects absent or incorrect authorization before account access", async () => {
    expect(validWebhookAuthorization(null, config.authorization)).toBe(false);
    expect(validWebhookAuthorization("incorrect", config.authorization)).toBe(false);
    expect((await handleRevenueCatWebhook(request({ api_version: "1.0", event }, "incorrect"), config)).status).toBe(401);
    expect(backend.user).not.toHaveBeenCalled();
    expect(backend.apply).not.toHaveBeenCalled();
  });
  it("rejects invalid payloads", async () => {
    expect((await handleRevenueCatWebhook(request({ event: {} }), config)).status).toBe(400);
    expect(backend.apply).not.toHaveBeenCalled();
  });
  it("accepts the provider test without granting credits", async () => {
    expect((await handleRevenueCatWebhook(request({ api_version: "1.0", event: { id: "test", type: "TEST" } }), config)).status).toBe(200);
    expect(backend.apply).not.toHaveBeenCalled();
  });
  it("only applies verified account payments atomically", async () => {
    expect((await handleRevenueCatWebhook(request({ api_version: "1.0", event }), config)).status).toBe(200);
    expect(backend.user).toHaveBeenCalledWith(event.app_user_id);
    expect(backend.apply).toHaveBeenCalledWith("apply_store_event", expect.objectContaining({ _user_id: event.app_user_id, _product_id: "cineflow_weekly", _paid: true }));
  });
  it("never recreates deleted accounts", async () => {
    backend.user.mockResolvedValue({ data: { user: null }, error: { status: 404 } });
    expect((await handleRevenueCatWebhook(request({ api_version: "1.0", event }), config)).status).toBe(200);
    expect(backend.apply).not.toHaveBeenCalled();
  });
  it("returns a retryable failure if credit delivery fails", async () => {
    backend.apply.mockResolvedValue({ data: null, error: { code: "database-unavailable" } });
    expect((await handleRevenueCatWebhook(request({ api_version: "1.0", event }), config)).status).toBe(503);
  });
  it("never processes sandbox purchases unless opted in", async () => {
    expect((await handleRevenueCatWebhook(request({ api_version: "1.0", event: { ...event, environment: "SANDBOX" } }), config)).status).toBe(200);
    expect(backend.apply).not.toHaveBeenCalled();
  });
});