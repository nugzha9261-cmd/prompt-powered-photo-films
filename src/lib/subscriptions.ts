import { z } from "zod";
import { SUBSCRIPTION_PLANS } from "./credits";

export const PREMIUM_ENTITLEMENT = "premium";
export const PAID_CREDITS_ROLL_OVER = true;
export const KEEP_CREDITS_ON_REFUND = true;

export function subscriptionPlan(productId: string) {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === productId);
}

const timestamp = z.number().int().min(0).max(8_640_000_000_000_000);
export const revenueCatEventSchema = z.object({
  api_version: z.literal("1.0"),
  event: z.object({
    // RevenueCat's dashboard TEST event omits the id; real events always carry one.
    id: z.string().min(1).max(200).optional(),
    type: z.string().min(1).max(80),
    app_id: z.string().min(1).max(200).optional(),
    app_user_id: z.string().min(1).max(200).optional(),
    product_id: z.string().min(1).max(200).optional(),
    entitlement_ids: z.array(z.string().max(200)).max(30).nullable().optional(),
    store: z.string().max(80).optional(),
    environment: z.enum(["PRODUCTION", "SANDBOX"]).optional(),
    transaction_id: z.string().min(1).max(200).optional(),
    original_transaction_id: z.string().min(1).max(200).optional(),
    event_timestamp_ms: timestamp.optional(),
    purchased_at_ms: timestamp.optional(),
    expiration_at_ms: timestamp.nullable().optional(),
    period_type: z.string().max(30).optional(),
    cancel_reason: z.string().max(80).nullable().optional(),
    price: z.number().finite().min(-1_000_000).max(1_000_000).nullable().optional(),
    is_family_share: z.boolean().optional(),
  }),
});
export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>["event"];
export type VerifiedSubscriptionEvent = {
  eventId: string; userId: string; productId: string; transactionId: string;
  originalTransactionId: string; environment: "PRODUCTION" | "SANDBOX";
  eventType: string; eventAt: number; expiresAt: number; revoked: boolean; credits: number;
};

/** Only trusted, supported Apple subscription events reach the database RPC. */
export function subscriptionEvent(event: RevenueCatEvent, allowSandbox = false): VerifiedSubscriptionEvent | null {
  if (!event.id || event.store !== "APP_STORE" || !event.environment) return null;
  if (event.environment === "SANDBOX" && !allowSandbox) return null;
  const plan = subscriptionPlan(event.product_id ?? "");
  if (!plan || !event.entitlement_ids?.includes(PREMIUM_ENTITLEMENT)) return null;
  const user = z.string().uuid().safeParse(event.app_user_id);
  if (!user.success) return null;
  const types = ["INITIAL_PURCHASE", "RENEWAL", "CANCELLATION", "UNCANCELLATION", "EXPIRATION", "BILLING_ISSUE", "SUBSCRIPTION_EXTENDED"];
  if (!types.includes(event.type)) return null;
  if (!event.transaction_id || !event.original_transaction_id || event.event_timestamp_ms == null || event.expiration_at_ms == null) return null;
  const payment = event.type === "INITIAL_PURCHASE" || event.type === "RENEWAL";
  const paid = payment && !event.is_family_share && event.period_type !== "TRIAL" && event.price != null && event.price > 0;
  return {
    eventId: event.id, userId: user.data, productId: plan.id,
    transactionId: event.transaction_id, originalTransactionId: event.original_transaction_id,
    environment: event.environment, eventType: event.type, eventAt: event.event_timestamp_ms,
    expiresAt: event.expiration_at_ms,
    revoked: event.type === "EXPIRATION" || (event.type === "CANCELLATION" && event.cancel_reason === "CUSTOMER_SUPPORT"),
    credits: paid ? plan.credits : 0,
  };
}

export function premiumIsActive(expiresAt: string | null, revoked: boolean, now = Date.now()) {
  return !revoked && expiresAt != null && Date.parse(expiresAt) > now;
}

/** Refund policy preserves already granted credits; access is handled separately. */
export function subscriptionCreditBalance(balance: number, grant: number, refunded = false) {
  if (refunded && KEEP_CREDITS_ON_REFUND) return balance;
  return PAID_CREDITS_ROLL_OVER ? balance + grant : grant;
}